/* @vitest-environment node */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { Miniflare } from 'miniflare';
import { describe, expect, it } from 'vitest';

type LeadViewerPayload = {
  contact: {
    entries: Array<Record<string, unknown>>;
    pagination: { total: number; totalPages: number };
  };
  whitepapers: {
    entries: Array<Record<string, unknown>>;
    pagination: { total: number; totalPages: number };
  };
};

const BUNDLE_SCRIPT_PATH = join(process.cwd(), 'scripts', 'tests', 'bundle-lead-viewer-worker.mjs');

async function bundleWorker(): Promise<string> {
  const result = spawnSync('node', [BUNDLE_SCRIPT_PATH], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to bundle lead viewer worker');
  }
  return result.stdout;
}

describe('lead viewer worker contract', () => {
  it('enforces auth, applies pagination, and records access logs', async () => {
    const script = await bundleWorker();
    const password = 'ultra-secret';
    const passwordHash = createHash('sha256').update(password).digest('hex');
    const mf = new Miniflare({
      script,
      modules: true,
      modulesRoot: process.cwd(),
      compatibilityDate: '2024-10-08',
      bindings: {
        LEAD_VIEWER_BASIC_AUTH_USERS: `analyst:${passwordHash}`,
        LEAD_VIEWER_BASIC_REALM: 'Lead Viewer',
        LEAD_VIEWER_IP_ALLOWLIST: '203.0.113.5',
        LEAD_VIEWER_ALLOWED_ORIGINS: 'https://ops.apotheon.ai',
      },
      d1Databases: {
        // NOTE: Binding names mirror Wrangler's configuration so the contract test exercises
        //       the same code paths as production. Using explicit IDs gives us room to
        //       introduce persisted fixtures later without touching this harness.
        LEAD_VIEWER_CONTACT_DB: ':memory:',
        LEAD_VIEWER_WHITEPAPER_DB: ':memory:',
        LEAD_VIEWER_AUDIT_DB: ':memory:',
      },
    });

    await mf.ready; // Ensure the in-memory workerd instance boots before seeding databases.
    const contactDb = await mf.getD1Database('LEAD_VIEWER_CONTACT_DB');
    // Seed a realistic set of contact submissions so pagination math mirrors what
    // operators see in production dashboards. Keeping the schema aligned with
    // the migrations prevents subtle drift between the Worker and this contract test.
    const contactTableSql = `CREATE TABLE contact_submissions (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      company TEXT,
      intent TEXT,
      message TEXT,
      domain TEXT,
      domain_classification TEXT,
      domain_flags TEXT,
      domain_rationale TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT,
      source_url TEXT,
      utm TEXT
    );`;
    await contactDb.prepare(contactTableSql).run();
    const contactSeedSql = `INSERT INTO contact_submissions
      (id, name, email, company, intent, message, domain, domain_classification, domain_flags, domain_rationale,
       ip_address, user_agent, created_at, source_url, utm)
     VALUES
      ('contact-1', 'Ada Lovelace', 'ada@example.com', 'Analytical Engines', 'sales', 'Please contact me',
       'example.com', 'allowed', '{}', 'meets criteria', '203.0.113.5', 'playwright', '2024-10-08T00:00:00Z',
       'https://apotheon.ai/about/contact/', '{"utm_medium":"paid"}'),
      ('contact-2', 'Grace Hopper', 'grace@example.com', 'Compilers Inc', 'support', 'Follow-up question',
       'example.com', 'allowed', '{}', 'meets criteria', '203.0.113.5', 'playwright', '2024-10-07T00:00:00Z',
       'https://apotheon.ai/about/contact/', '{"utm_medium":"paid"}')
    ;`;
    await contactDb.prepare(contactSeedSql).run();

    const whitepaperDb = await mf.getD1Database('LEAD_VIEWER_WHITEPAPER_DB');
    // Whitepaper requests exercise the secondary dataset path to ensure both
    // the Worker aggregation logic and CSV export surfaces stay healthy.
    const whitepaperTableSql = `CREATE TABLE whitepaper_requests (
      id TEXT PRIMARY KEY,
      whitepaper_slug TEXT,
      whitepaper_title TEXT,
      name TEXT,
      email TEXT,
      company TEXT,
      role TEXT,
      justification TEXT,
      domain TEXT,
      domain_classification TEXT,
      domain_flags TEXT,
      domain_rationale TEXT,
      ip_address TEXT,
      user_agent TEXT,
      marketing_opt_in INTEGER,
      signed_url_expires_at TEXT,
      asset_object_key TEXT,
      source_url TEXT,
      utm TEXT,
      created_at TEXT
    );`;
    await whitepaperDb.prepare(whitepaperTableSql).run();
    const whitepaperSeedSql = `INSERT INTO whitepaper_requests
      (id, whitepaper_slug, whitepaper_title, name, email, company, role, justification,
       domain, domain_classification, domain_flags, domain_rationale, ip_address, user_agent,
       marketing_opt_in, signed_url_expires_at, asset_object_key, source_url, utm, created_at)
     VALUES
      ('whitepaper-1', 'zero-trust', 'Zero Trust Reference Architecture', 'Joan Clarke',
       'joan@example.com', 'Enigma Labs', 'Security Architect', 'Evaluating zero trust rollout',
       'example.com', 'allowed', '{}', 'meets criteria', '203.0.113.5', 'playwright', 1,
       '2024-10-09T00:00:00Z', 'whitepapers/zero-trust.pdf', 'https://apotheon.ai/whitepapers/', '{"utm_source":"campaign"}',
       '2024-10-08T00:00:00Z')
    ;`;
    await whitepaperDb.prepare(whitepaperSeedSql).run();

    const auditDb = await mf.getD1Database('LEAD_VIEWER_AUDIT_DB');
    // The audit trail ensures compliance teams can track viewing activity. The
    // contract test asserts that the Worker writes to this table on every request.
    const auditTableSql = `CREATE TABLE lead_viewer_access_log (
      id TEXT PRIMARY KEY,
      actor TEXT,
      ip_address TEXT,
      user_agent TEXT,
      search_term TEXT,
      page INTEGER,
      per_page INTEGER,
      requested_datasets TEXT,
      created_at TEXT
    );`;
    await auditDb.prepare(auditTableSql).run();

    const unauthorized = await mf.dispatchFetch('https://leads.apotheon.ai/api/leads', {
      headers: {
        Origin: 'https://ops.apotheon.ai',
        'cf-connecting-ip': '203.0.113.5',
      },
    });
    expect(unauthorized.status).toBe(401);

    const response = await mf.dispatchFetch('https://leads.apotheon.ai/api/leads?perPage=1', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(`analyst:${password}`).toString('base64')}`,
        Origin: 'https://ops.apotheon.ai',
        'cf-connecting-ip': '203.0.113.5',
        'user-agent': 'contract-test',
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://ops.apotheon.ai');

    const body = (await response.json()) as LeadViewerPayload;
    expect(body.contact.entries).toHaveLength(1);
    expect(body.contact.pagination.total).toBe(2);
    expect(body.whitepapers.entries).toHaveLength(1);
    expect(body.whitepapers.pagination.total).toBe(1);

    const auditResults = await auditDb
      .prepare('SELECT actor, requested_datasets FROM lead_viewer_access_log')
      .all<{ actor: string; requested_datasets: string }>();
    expect(auditResults.results?.[0]?.actor).toBe('analyst');
    expect(auditResults.results?.[0]?.requested_datasets).toBe('contact,whitepapers');

    await mf.dispose();
  });
});
