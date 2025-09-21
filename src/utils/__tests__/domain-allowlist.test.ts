import { describe, expect, it, vi } from 'vitest';

import {
  analyzeDomain,
  extractDomain,
  lookupMxRecords,
  shouldPerformMxLookup,
} from '../domain-allowlist';
import { HAPPY_PATH_CORPORATE_DOMAINS, HIGH_RISK_DOMAINS } from '../domain-fixtures';

describe('domain allowlist utilities', () => {
  it('extracts domains from valid email addresses', () => {
    expect(extractDomain('owner@apotheon.ai')).toBe('apotheon.ai');
    expect(extractDomain(' OWNER@APOTHEON.AI ')).toBe('apotheon.ai');
  });

  it('returns null for malformed addresses', () => {
    expect(extractDomain('owner')).toBeNull();
    expect(extractDomain('owner@')).toBeNull();
  });

  it('blocks known disposable providers', () => {
    const target = HIGH_RISK_DOMAINS[0];
    const result = analyzeDomain(`user@${target}`);
    expect(result.classification).toBe('block');
    expect(result.flags.disposable).toBe(true);
  });

  it('auto approves allowlisted corporate domains', () => {
    const target = HAPPY_PATH_CORPORATE_DOMAINS[0];
    const result = analyzeDomain(`buyer@${target}`);
    expect(result.classification).toBe('allow');
    expect(result.flags.allowlisted).toBe(true);
  });

  it('flags unknown domains for MX verification', () => {
    const result = analyzeDomain('buyer@unknown-enterprise.io');
    expect(result.classification).toBe('review');
    expect(shouldPerformMxLookup(result)).toBe(true);
  });

  it('respects runtime overrides', () => {
    const result = analyzeDomain('vip@emerging-partner.dev', {
      additionalAllowlist: ['emerging-partner.dev'],
    });

    expect(result.classification).toBe('allow');
  });

  it('performs DNS lookups and surfaces MX records', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Answer: [{ data: '10 inbound.example.com.' }] }),
    });

    const result = await lookupMxRecords('example.com', mockFetch as unknown as typeof fetch);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.hasMxRecords).toBe(true);
    expect(result.records).toContain('10 inbound.example.com.');
  });

  it('handles resolver failures gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await lookupMxRecords('example.com', mockFetch as unknown as typeof fetch);
    expect(result.hasMxRecords).toBe(false);
    expect(result.records).toEqual([]);
  });
});
