import { describe, expect, it } from 'vitest';

import { resolveAsset } from '../content/run-vale.mjs';

describe('resolveAsset', () => {
  it('resolves linux x64 assets', () => {
    expect(resolveAsset('linux', 'x64')).toMatchObject({
      releaseUrl: expect.stringContaining('Linux_64-bit.tar.gz'),
      archiveType: 'tar.gz',
      binaryName: 'vale',
    });
  });

  it('resolves macOS arm64 assets', () => {
    expect(resolveAsset('darwin', 'arm64')).toMatchObject({
      releaseUrl: expect.stringContaining('macOS_arm64.tar.gz'),
      archiveType: 'tar.gz',
      binaryName: 'vale',
    });
  });

  it('resolves linux arm64 assets', () => {
    expect(resolveAsset('linux', 'arm64')).toMatchObject({
      releaseUrl: expect.stringContaining('Linux_arm64.tar.gz'),
      archiveType: 'tar.gz',
      binaryName: 'vale',
    });
  });

  it('resolves macOS x64 assets', () => {
    expect(resolveAsset('darwin', 'x64')).toMatchObject({
      releaseUrl: expect.stringContaining('macOS_64-bit.tar.gz'),
      archiveType: 'tar.gz',
      binaryName: 'vale',
    });
  });

  it('resolves Windows x64 assets', () => {
    expect(resolveAsset('win32', 'x64')).toMatchObject({
      releaseUrl: expect.stringContaining('Windows_64-bit.zip'),
      archiveType: 'zip',
      binaryName: 'vale.exe',
    });
  });

  it('throws for unsupported platforms', () => {
    expect(() => resolveAsset('aix', 'ppc64')).toThrow(/Unsupported platform/);
  });

  it('throws for unsupported architectures', () => {
    expect(() => resolveAsset('darwin', 'ppc')).toThrow(/Unsupported architecture/);
  });
});
