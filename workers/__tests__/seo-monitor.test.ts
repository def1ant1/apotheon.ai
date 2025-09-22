import { describe, expect, it, vi } from 'vitest';

import { MemoryD1Database, runSeoMonitor } from '../seo-monitor';

describe('seo monitor worker', () => {
  it('persists metrics and records alerts when thresholds are exceeded', async () => {
    const db = new MemoryD1Database();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          record: {
            metrics: {
              largest_contentful_paint: { percentiles: { p75: 3200 } },
              interaction_to_next_paint: { percentiles: { p75: 180 } },
              cumulative_layout_shift: { percentiles: { p75: 0.12 } },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          coverage: [
            { category: 'error', count: 3 },
            { category: 'valid', count: 1200 },
          ],
        }),
      })
      .mockResolvedValue({ ok: true, text: async () => '', json: async () => ({}) });

    await runSeoMonitor(
      {
        SEO_MONITOR_DB: db,
        SEO_MONITOR_CRUX_API_KEY: 'test-key',
        SEO_MONITOR_SEARCH_CONSOLE_TOKEN: 'token',
        SEO_MONITOR_ALERT_WEBHOOK: 'https://hooks.example.com/test',
        SEO_MONITOR_PROPERTY_STAGE: 'production',
      },
      { fetchImplementation: fetchMock, logger: console },
    );

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(db.executed.some((entry) => entry.sql.includes('seo_monitor_core_web_vitals'))).toBe(
      true,
    );
    expect(
      db.executed.some((entry) => entry.sql.includes('seo_monitor_search_console_coverage')),
    ).toBe(true);
    expect(db.executed.some((entry) => entry.sql.includes('seo_monitor_alerts'))).toBe(true);
  });

  it('supports dry-run execution without touching the database', async () => {
    const db = new MemoryD1Database();
    const fetchMock = vi.fn();

    await runSeoMonitor(
      {
        SEO_MONITOR_DB: db,
        SEO_MONITOR_DRY_RUN: 'true',
      },
      { fetchImplementation: fetchMock, logger: console },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.executed).toHaveLength(0);
  });
});
