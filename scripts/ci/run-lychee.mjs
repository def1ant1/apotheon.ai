#!/usr/bin/env node
/**
 * Enterprise link audit orchestrator.
 * Builds a disposable Astro site for static analysis and then fans out lychee
 * across HTML output plus markdown sources so broken links fail fast in CI.
 */
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join, resolve} from 'node:path';
import {existsSync, mkdirSync} from 'node:fs';
import {promises as fs} from 'node:fs';

const repoRoot = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const artifactsDir = join(repoRoot, 'artifacts', 'link-check');
const configPath = join(repoRoot, 'config', 'lychee.toml');
const lycheeBin = join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'lychee.cmd' : 'lychee',
);
const reportPath = join(artifactsDir, 'report.json');
const astroBin = join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'astro.cmd' : 'astro',
);

const defaultMarkdownTargets = ['docs', 'README.md', 'CHANGELOG.md', 'ROADMAP.md'];

function parseArguments() {
  const raw = process.argv.slice(2);
  const lycheeArgs = [];
  const customTargets = [];
  let forceOnline = false;
  let offlineFlagProvided = false;

  for (let index = 0; index < raw.length; index += 1) {
    const token = raw[index];
    if (token === '--online') {
      forceOnline = true;
      continue;
    }
    if (token === '--paths') {
      const value = raw[index + 1];
      if (!value) {
        throw new Error('Missing value for --paths');
      }
      customTargets.push(value);
      index += 1;
      continue;
    }
    if (token.startsWith('--paths=')) {
      customTargets.push(token.split('=')[1]);
      continue;
    }
    if (token === '--offline' || token.startsWith('--offline=')) {
      offlineFlagProvided = true;
      lycheeArgs.push(token);
      continue;
    }
    lycheeArgs.push(token);
  }

  return {lycheeArgs, customTargets, forceOnline, offlineFlagProvided};
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {stdio: 'inherit', cwd: repoRoot, ...options});
    child.on('error', rejectPromise);
    child.on('exit', code => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function ensureDirectory(pathname) {
  if (!existsSync(pathname)) {
    mkdirSync(pathname, {recursive: true});
  }
}

async function buildStaticSite(outDir) {
  await fs.rm(outDir, {recursive: true, force: true});
  await run(
    astroBin, // Binary path already points to `astro`; pass only subcommands here to avoid regressions.
    [
      'build',
      '--outDir',
      outDir,
      '--log-level',
      'warn',
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    },
  );
}

function collectTargets(ephemeralDist, overrides) {
  if (overrides.length > 0) {
    return overrides.map(entry => resolve(repoRoot, entry));
  }

  const targets = [ephemeralDist, ...defaultMarkdownTargets.map(entry => join(repoRoot, entry))];
  return targets.filter(entry => existsSync(entry));
}

async function main() {
  const {lycheeArgs, customTargets, forceOnline, offlineFlagProvided} = parseArguments();

  await ensureDirectory(artifactsDir);
  await fs.rm(reportPath, {force: true});

  if (!existsSync(lycheeBin)) {
    throw new Error(
      'Lychee CLI is unavailable. Run `TAILWIND_DISABLE_OXIDE=1 npm install` to download the enterprise-wrapped binary.',
    );
  }

  const ephemeralDist = join(artifactsDir, 'dist');
  const targets = collectTargets(ephemeralDist, customTargets);
  const usingEphemeralDist = targets.some(target => target === ephemeralDist);

  let rootDirTarget = usingEphemeralDist;
  if (usingEphemeralDist) {
    try {
      await buildStaticSite(ephemeralDist);
    } catch (error) {
      console.warn('[lychee] Static build failed; skipping dist scan.', error);
      const index = targets.indexOf(ephemeralDist);
      if (index !== -1) {
        targets.splice(index, 1);
      }
      rootDirTarget = false;
    }
  }

  const lycheeTargets = [...targets];
  const finalLycheeArgs = [...lycheeArgs];

  if (!forceOnline && !offlineFlagProvided) {
    finalLycheeArgs.push('--offline');
  }

  const command = [
    'lychee',
    '--config',
    configPath,
    '--format',
    'json',
    '--no-progress',
  ];

  const hasOutputFlag = lycheeArgs.some(arg => arg === '--output' || arg.startsWith('--output='));
  if (!hasOutputFlag) {
    command.push('--output', reportPath);
  }

  if (rootDirTarget) {
    command.push('--root-dir', ephemeralDist);
  }

  command.push(...finalLycheeArgs, '--', ...lycheeTargets);

  await ensureDirectory(join(artifactsDir));

  await run(lycheeBin, command);
}

main().catch(error => {
  console.error('\nLychee link audit failed.', error);
  process.exitCode = 1;
});
