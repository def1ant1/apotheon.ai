import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

class FakeStatement {
  public params: unknown[] = [];

  constructor(public readonly sql: string) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }
}

class FakeD1Database {
  public readonly execCalls: string[] = [];
  public readonly batchCalls: Array<{ sql: string; params: unknown[] }> = [];

  prepare(sql: string) {
    return new FakeStatement(sql);
  }

  async batch(statements: FakeStatement[]) {
    for (const statement of statements) {
      this.batchCalls.push({ sql: statement.sql, params: statement.params });
    }
    return statements.map(() => ({ success: true }));
  }

  async exec(sql: string) {
    this.execCalls.push(sql);
    return { success: true };
  }
}

describe('blog analytics worker contract', () => {
  it('persists rollups to D1', async () => {
    const db = new FakeD1Database();
    const migration = await readFile(
      join(process.cwd(), 'workers', 'migrations', 'blog-analytics', '0001_init.sql'),
      'utf8',
    );
    await db.exec(migration);

    const payload = {
      dataset: 'blog',
      events: [
        {
          type: 'article_view',
          slug: 'welcome',
          sessionId: 'session-123',
          occurredAt: new Date('2024-10-01T10:00:00Z').toISOString(),
          identity: { domain: 'example.com' },
        },
      ],
    };

    const workerModule = await import('../blog-analytics');
    const worker = workerModule.default;
    type WorkerEnv = Parameters<typeof worker.fetch>[1];
    const env = {
      BLOG_ANALYTICS_DB: db as unknown,
      BLOG_ANALYTICS_ALLOWED_ORIGINS: 'http://localhost:4321',
    } as WorkerEnv;

    const response = await worker.fetch(
      new Request('http://localhost:8787', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:4321' },
        body: JSON.stringify(payload),
      }),
      env,
    );

    expect(response.status).toBe(202);

    expect(
      db.execCalls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS blog_event_rollups')),
    ).toBe(true);
    const rollupInsert = db.batchCalls.find((entry) =>
      entry.sql.includes('INSERT INTO blog_event_rollups'),
    );
    expect(rollupInsert?.params).toEqual([
      '2024-10-01',
      'welcome',
      'article_view',
      'example.com',
      expect.any(String),
      expect.any(String),
      1,
      1,
    ]);
    const payloadInsert = db.batchCalls.find((entry) =>
      entry.sql.includes('INSERT OR IGNORE INTO blog_event_payloads'),
    );
    expect(payloadInsert?.params?.[1]).toContain('"slug":"welcome"');
  });
});
