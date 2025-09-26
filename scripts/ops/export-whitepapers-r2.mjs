#!/usr/bin/env node

/**
 * Snapshot the public whitepaper assets stored in R2, encrypt them, and stream
 * the resulting blobs into a hardened backup bucket. The workflow mirrors what a
 * responder would do manually (list → download → encrypt → upload) but removes
 * toil via automation and deeply documented logging so we can trace every
 * decision during post-incident reviews.
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, Readable } from 'node:stream';
import {
  constants as cryptoConstants,
  createCipheriv,
  createHash,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const RUNBOOK_SLUG = 'docs/security/RUNBOOK_R2_INCIDENT.md';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const verbose = args.has('--verbose');

function log(message, context = {}) {
  const payload = { message, ...context };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

function warn(message, context = {}) {
  const payload = { level: 'warn', message, ...context };
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify(payload));
}

const REQUIRED_ENV = [
  'WHITEPAPERS_R2_BUCKET',
  'WHITEPAPERS_BACKUP_BUCKET',
  'CLOUDFLARE_ACCOUNT_ID',
  'BACKUP_R2_ACCESS_KEY_ID',
  'BACKUP_R2_SECRET_ACCESS_KEY',
  'BACKUP_ENCRYPTION_PUBLIC_KEY',
];

function collectMissingEnv() {
  return REQUIRED_ENV.filter((key) => !process.env[key]);
}

function ensureEnv(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function buildS3Client({
  accountId,
  accessKeyId,
  secretAccessKey,
  endpoint,
}) {
  const resolvedEndpoint = endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`;
  const region = process.env.BACKUP_R2_REGION ?? 'auto';

  return new S3Client({
    region,
    endpoint: resolvedEndpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

async function toNodeReadable(streamLike) {
  if (!streamLike) {
    throw new Error('Object body was empty.');
  }

  if (typeof streamLike.pipe === 'function') {
    return streamLike;
  }

  const isReadableStream =
    typeof ReadableStream !== 'undefined' && streamLike instanceof ReadableStream;

  if (typeof streamLike.getReader === 'function' || isReadableStream) {
    return Readable.fromWeb(streamLike);
  }

  if (typeof streamLike.arrayBuffer === 'function') {
    const buffer = Buffer.from(await streamLike.arrayBuffer());
    return Readable.from(buffer);
  }

  if (Symbol.asyncIterator in streamLike) {
    return Readable.from(streamLike);
  }

  throw new Error('Unsupported stream type returned from R2.');
}

async function encryptFile({ sourcePath, destinationPath }) {
  const encryptionKey = randomBytes(32);
  const initializationVector = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, initializationVector);
  const checksum = createHash('sha256');
  const hashingStream = new Transform({
    transform(chunk, _encoding, callback) {
      checksum.update(chunk);
      callback(null, chunk);
    },
  });

  await pipeline(createReadStream(sourcePath), cipher, hashingStream, createWriteStream(destinationPath));

  const authenticationTag = cipher.getAuthTag();
  const checksumHex = checksum.digest('hex');
  const checksumBase64 = Buffer.from(checksumHex, 'hex').toString('base64');
  const envelopePlaintext = Buffer.concat([encryptionKey, initializationVector, authenticationTag]);
  const publicKey = ensureEnv('BACKUP_ENCRYPTION_PUBLIC_KEY');
  const encryptedEnvelope = publicEncrypt(
    {
      key: publicKey,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    envelopePlaintext,
  ).toString('base64');

  return {
    checksumHex,
    checksumBase64,
    initializationVector: initializationVector.toString('base64'),
    authenticationTag: authenticationTag.toString('base64'),
    encryptedEnvelope,
    algorithm: 'AES-256-GCM',
    keyEnvelopeAlgorithm: 'RSA-OAEP-SHA256',
  };
}

async function listObjects({ client, bucket }) {
  const objects = [];
  let continuationToken;

  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        ContinuationToken: continuationToken,
      }),
    );

    const contents = response.Contents ?? [];
    for (const item of contents) {
      if (!item.Key || item.Key.endsWith('/')) continue;
      objects.push({ key: item.Key, size: item.Size ?? 0, etag: item.ETag ?? '' });
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return objects;
}

async function downloadObject({ client, bucket, key, destinationPath }) {
  await mkdir(dirname(destinationPath), { recursive: true });
  const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bodyStream = await toNodeReadable(response.Body);
  await pipeline(bodyStream, createWriteStream(destinationPath));
  return response.ContentLength ?? 0;
}

async function uploadEncryptedObject({
  client,
  bucket,
  key,
  sourcePath,
  checksumBase64,
  metadata,
}) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: createReadStream(sourcePath),
      ChecksumSHA256: checksumBase64,
      ContentType: 'application/octet-stream',
      Metadata: metadata,
    }),
  );
}

async function main() {
  const missing = collectMissingEnv();
  if (dryRun) {
    if (missing.length > 0) {
      warn('Dry-run detected missing environment variables (expected in CI).', { missing });
    }
    log('Dry-run: Skipping R2 export operations', {
      script: 'export-whitepapers-r2',
      runbook: RUNBOOK_SLUG,
    });
    return;
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const accountId = ensureEnv('CLOUDFLARE_ACCOUNT_ID');
  const sourceBucket = ensureEnv('WHITEPAPERS_R2_BUCKET');
  const backupBucket = ensureEnv('WHITEPAPERS_BACKUP_BUCKET');
  const prefix = process.env.WHITEPAPERS_BACKUP_PREFIX ?? 'whitepapers';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const workingDirectory = await mkdtemp(join(tmpdir(), 'whitepapers-backup-'));

  const cleanup = async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  };

  const sourceClient = buildS3Client({
    accountId,
    accessKeyId: process.env.WHITEPAPERS_R2_ACCESS_KEY_ID ?? ensureEnv('BACKUP_R2_ACCESS_KEY_ID'),
    secretAccessKey:
      process.env.WHITEPAPERS_R2_SECRET_ACCESS_KEY ?? ensureEnv('BACKUP_R2_SECRET_ACCESS_KEY'),
    endpoint: process.env.WHITEPAPERS_R2_ENDPOINT ?? process.env.BACKUP_R2_ENDPOINT,
  });

  const backupClient = buildS3Client({
    accountId,
    accessKeyId: ensureEnv('BACKUP_R2_ACCESS_KEY_ID'),
    secretAccessKey: ensureEnv('BACKUP_R2_SECRET_ACCESS_KEY'),
    endpoint: process.env.BACKUP_R2_ENDPOINT,
  });

  try {
    const objects = await listObjects({ client: sourceClient, bucket: sourceBucket });
    log('Discovered whitepaper assets', { count: objects.length });

    const manifestItems = [];

    for (const object of objects) {
      const sanitizedKey = object.key.replace(/\//g, '__');
      const rawPath = join(workingDirectory, 'raw', sanitizedKey);
      const encryptedPath = `${rawPath}.enc`;

      log('Processing whitepaper object', { key: object.key });
      await downloadObject({
        client: sourceClient,
        bucket: sourceBucket,
        key: object.key,
        destinationPath: rawPath,
      });

      const encryptionArtifacts = await encryptFile({
        sourcePath: rawPath,
        destinationPath: encryptedPath,
      });

      const backupKey = `${prefix}/${timestamp}/${object.key}.enc`;

      await uploadEncryptedObject({
        client: backupClient,
        bucket: backupBucket,
        key: backupKey,
        sourcePath: encryptedPath,
        checksumBase64: encryptionArtifacts.checksumBase64,
        metadata: {
          dataset: 'whitepapers_r2',
          runbook: RUNBOOK_SLUG,
          sourceKey: object.key,
        },
      });

      manifestItems.push({
        sourceKey: object.key,
        backupKey,
        size: object.size,
        checksum: {
          algorithm: 'sha256',
          value: encryptionArtifacts.checksumHex,
        },
        encryption: {
          algorithm: encryptionArtifacts.algorithm,
          initializationVector: encryptionArtifacts.initializationVector,
          authenticationTag: encryptionArtifacts.authenticationTag,
          keyEnvelope: encryptionArtifacts.encryptedEnvelope,
          keyEnvelopeAlgorithm: encryptionArtifacts.keyEnvelopeAlgorithm,
        },
      });
    }

    const manifest = {
      version: '2024-10-08',
      dataset: 'whitepapers_r2',
      generatedAt: new Date().toISOString(),
      sourceBucket,
      backupBucket,
      itemCount: manifestItems.length,
      runbook: RUNBOOK_SLUG,
      items: manifestItems,
    };

    const manifestKey = `${prefix}/${timestamp}/manifest.json`;
    await backupClient.send(
      new PutObjectCommand({
        Bucket: backupBucket,
        Key: manifestKey,
        Body: JSON.stringify(manifest, null, 2),
        ContentType: 'application/json',
        Metadata: {
          dataset: 'whitepapers_r2',
          runbook: RUNBOOK_SLUG,
        },
      }),
    );

    log('Whitepaper R2 backup completed', {
      backupBucket,
      manifestKey,
      itemCount: manifestItems.length,
    });
  } catch (error) {
    warn('Whitepaper R2 backup failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  } finally {
    await cleanup().catch((cleanupError) => {
      warn('Failed to clean up working directory', {
        workingDirectory,
        error:
          cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup failure',
      });
    });
  }
}

main().catch((error) => {
  if (verbose) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
  process.exitCode = 1;
});
