/// <reference types="@cloudflare/workers-types" />

import type {
  D1Database,
  D1DatabaseSession,
  D1ExecResult,
  D1PreparedStatement,
  D1Result,
  D1SessionBookmark,
} from '@cloudflare/workers-types';

class MemoryD1Statement implements D1PreparedStatement {
  constructor(
    private readonly sql: string,
    private readonly db: MemoryD1Database,
    private readonly params: unknown[] = [],
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    return new MemoryD1Statement(this.sql, this.db, [...this.params, ...values]);
  }

  first<T = unknown>(colName: string): Promise<T | null>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  first<T = unknown>(_colNameOrOptions?: string | { columnNames: true }): Promise<T | null> {
    void _colNameOrOptions;
    return Promise.reject(new Error('Not implemented in MemoryD1Statement stub.'));
  }

  run<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    this.db.executed.push({ sql: this.sql, params: this.params });
    const result: D1Result<T> = {
      success: true,
      results: [],
      meta: {
        duration: 0,
        size_after: 0,
        rows_read: 0,
        rows_written: 0,
        last_row_id: 0,
        changed_db: false,
        changes: 0,
      },
    };
    return Promise.resolve(result);
  }

  all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
    return Promise.reject(new Error('Not implemented in MemoryD1Statement stub.'));
  }

  raw<T = unknown[]>(options: { columnNames: true }): Promise<[string[], ...T[]]>;
  raw<T = unknown[]>(options?: { columnNames?: false }): Promise<T[]>;
  raw<T = unknown[]>(_options?: { columnNames?: boolean }): Promise<T[] | [string[], ...T[]]> {
    void _options;
    return Promise.reject(new Error('Not implemented in MemoryD1Statement stub.'));
  }
}

class MemoryD1DatabaseSession implements D1DatabaseSession {
  constructor(private readonly db: MemoryD1Database) {}

  prepare(query: string): D1PreparedStatement {
    return this.db.prepare(query);
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    void _statements;
    return Promise.reject(new Error('Not implemented in MemoryD1DatabaseSession stub.'));
  }

  getBookmark(): D1SessionBookmark | null {
    return null;
  }
}

class MemoryD1Database implements D1Database {
  public readonly executed: Array<{ sql: string; params: unknown[] }> = [];

  prepare(query: string): D1PreparedStatement {
    return new MemoryD1Statement(query, this);
  }

  batch<T = unknown>(_statements: D1PreparedStatement[]): Promise<D1Result<T>[]> {
    void _statements;
    return Promise.reject(new Error('Not implemented in MemoryD1Database stub.'));
  }

  dump(): Promise<ArrayBuffer> {
    return Promise.reject(new Error('Not implemented in MemoryD1Database stub.'));
  }

  exec(): Promise<D1ExecResult> {
    return Promise.resolve({ count: 0, duration: 0 });
  }

  withSession(_constraintOrBookmark?: unknown): D1DatabaseSession {
    void _constraintOrBookmark;
    return new MemoryD1DatabaseSession(this);
  }
}

export { MemoryD1Database };
