#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDir = resolve('dist/ladle');
await mkdir(outputDir, { recursive: true });
