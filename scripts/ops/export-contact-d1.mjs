#!/usr/bin/env node

/**
 * Export the contact form D1 database, encrypt the archive, and stream it to an
 * R2 bucket ready for long-term retention. The script intentionally leans on
 * `wrangler d1 export` so the bundle mirrors what operators run manually today
 * and wraps the output with AES-256-GCM + RSA key wrapping to satisfy security
 * controls. Extensive inline notes double as a runbook for on-call engineers
 * who need to reason about failures at 02:00.
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import {
  constants as cryptoConstants,
  createCipheriv,
  createHash,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const RUNBOOK_SLUG = 'docs/security/RUNBOOK_CONTACT_ABUSE.md';

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
  'CONTACT_D1_DATABASE',
  'CLOUDFLARE_ACCOUNT_ID',
  'CONTACT_BACKUP_BUCKET',
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

async function exportDatabase({ databaseName, destinationPath }) {
  const wranglerBin = process.env.WRANGLER_BINARY ?? 'npx';
  const argsList =
    wranglerBin === 'npx'
      ? ['wrangler', 'd1', 'export', databaseName, '--output', '-']
      : ['d1', 'export', databaseName, '--output', '-'];

  log('Starting D1 export', { databaseName, destinationPath, wranglerBin });

  const exportProcess = spawn(wranglerBin, argsList, {
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  await pipeline(exportProcess.stdout, createWriteStream(destinationPath));

  const exitCode = await new Promise((resolve) => {
    exportProcess.on('close', resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`wrangler d1 export exited with status ${exitCode}`);
  }

  log('Completed D1 export', { destinationPath });
}

async function encryptArchive({ sourcePath, destinationPath }) {
  const encryptionKey = randomBytes(32); // AES-256 key material.
  const initializationVector = randomBytes(12); // GCM standard IV length.

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

  log('Encrypted archive', { destinationPath, checksumHex });

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

function buildS3Client({ accountId }) {
  const region = process.env.BACKUP_R2_REGION ?? 'auto';
  const endpoint =
    process.env.BACKUP_R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: ensureEnv('BACKUP_R2_ACCESS_KEY_ID'),
      secretAccessKey: ensureEnv('BACKUP_R2_SECRET_ACCESS_KEY'),
    },
  });
}

async function uploadArtifacts({
  s3,
  bucket,
  objectKey,
  manifestKey,
  encryptedFilePath,
  manifest,
  checksumBase64,
}) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: createReadStream(encryptedFilePath),
      ChecksumSHA256: checksumBase64,
      ContentType: 'application/octet-stream',
      Metadata: {
        dataset: 'contact_submissions',
        runbook: RUNBOOK_SLUG,
      },
    }),
  );

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: manifestKey,
      Body: JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
      Metadata: {
        dataset: 'contact_submissions',
        runbook: RUNBOOK_SLUG,
      },
    }),
  );

  log('Uploaded encrypted archive and manifest', { objectKey, manifestKey });
}

async function main() {
  const missing = collectMissingEnv();
  if (dryRun) {
    if (missing.length > 0) {
      warn('Dry-run detected missing environment variables (expected in CI).', { missing });
    }
    log('Dry-run: Skipping export and upload operations', {
      script: 'export-contact-d1',
      runbook: RUNBOOK_SLUG,
    });
    return;
  }

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const workingDirectory = await mkdtemp(join(tmpdir(), 'contact-backup-'));
  const rawPath = join(workingDirectory, `contact-submissions-${timestamp}.sql`);
  const encryptedPath = `${rawPath}.enc`;

  const cleanup = async () => {
    await rm(workingDirectory, { recursive: true, force: true });
  };

  try {
    await exportDatabase({
      databaseName: ensureEnv('CONTACT_D1_DATABASE'),
      destinationPath: rawPath,
    });

    const encryptionArtifacts = await encryptArchive({
      sourcePath: rawPath,
      destinationPath: encryptedPath,
    });

    const accountId = ensureEnv('CLOUDFLARE_ACCOUNT_ID');
    const s3 = buildS3Client({ accountId });
    const bucket = ensureEnv('CONTACT_BACKUP_BUCKET');
    const prefix = process.env.CONTACT_BACKUP_PREFIX ?? 'contact-submissions';
    const objectKey = `${prefix}/${timestamp}/contact-submissions.sql.enc`;
    const manifestKey = `${prefix}/${timestamp}/manifest.json`;

    const manifest = {
      version: '2024-10-08',
      dataset: 'contact_submissions',
      source: {
        database: process.env.CONTACT_D1_DATABASE,
        accountId,
      },
      generatedAt: new Date().toISOString(),
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
      runbook: RUNBOOK_SLUG,
    };

    await uploadArtifacts({
      s3,
      bucket,
      objectKey,
      manifestKey,
      encryptedFilePath: encryptedPath,
      manifest,
      checksumBase64: encryptionArtifacts.checksumBase64,
    });

    log('Contact D1 backup completed', {
      bucket,
      objectKey,
      manifestKey,
    });
  } catch (error) {
    warn('Contact D1 backup failed', {
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
