/// <reference types="@cloudflare/workers-types" />

/**
 * Lead Viewer Worker
 * -------------------
 *
 * Security and RevOps stakeholders review inbound leads (contact form
 * submissions and whitepaper downloads) through this dedicated Worker. The
 * runtime enforces Basic Auth + IP allow lists, fans queries out to the
 * existing contact and whitepaper D1 databases, and returns paginated, audit-
 * friendly JSON. Every request is logged to a separate D1 table for compliance
 * so we can prove who accessed which datasets.
 */
import { z } from 'zod';

export interface LeadViewerEnv {
  LEAD_VIEWER_CONTACT_DB: D1Database;
  LEAD_VIEWER_WHITEPAPER_DB: D1Database;
  LEAD_VIEWER_AUDIT_DB: D1Database;
  LEAD_VIEWER_BASIC_AUTH_USERS?: string;
  LEAD_VIEWER_BASIC_REALM?: string;
  LEAD_VIEWER_IP_ALLOWLIST?: string;
  LEAD_VIEWER_ALLOWED_ORIGINS?: string;
}

interface ParsedCredentials {
  username: string;
  password: string;
}

interface StoredCredentialMap {
  username: string;
  hash: string;
}

interface PaginationInput {
  search: string | null;
  page: number;
  perPage: number;
}

interface DatasetResult<T> {
  entries: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

interface ContactEntry {
  id: string;
  name: string;
  email: string;
  company: string;
  intent: string;
  message: string;
  domain: string;
  domainClassification: string;
  domainFlags: string;
  domainRationale: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  sourceUrl: string | null;
  utm: string | null;
}

interface WhitepaperEntry {
  id: string;
  whitepaperSlug: string;
  whitepaperTitle: string;
  name: string;
  email: string;
  company: string;
  role: string;
  justification: string;
  domain: string;
  domainClassification: string;
  domainFlags: string;
  domainRationale: string;
  ipAddress: string | null;
  userAgent: string | null;
  marketingOptIn: boolean;
  signedUrlExpiresAt: string;
  assetObjectKey: string;
  sourceUrl: string | null;
  utm: string | null;
  createdAt: string;
}

type RawContactRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  intent: string;
  message: string;
  domain: string;
  domain_classification: string;
  domain_flags: string;
  domain_rationale: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  source_url: string | null;
  utm: string | null;
};

type RawWhitepaperRow = {
  id: string;
  whitepaper_slug: string;
  whitepaper_title: string;
  name: string;
  email: string;
  company: string;
  role: string;
  justification: string;
  domain: string;
  domain_classification: string;
  domain_flags: string;
  domain_rationale: string;
  ip_address: string | null;
  user_agent: string | null;
  marketing_opt_in: number;
  signed_url_expires_at: string;
  asset_object_key: string;
  source_url: string | null;
  utm: string | null;
  created_at: string;
};

const paginationSchema = z.object({
  search: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(25),
});

const BASIC_PREFIX = 'Basic ';

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export default {
  async fetch(request: Request, env: LeadViewerEnv, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('origin');
    const allowedOrigins = parseCsvList(env.LEAD_VIEWER_ALLOWED_ORIGINS);

    if (request.method === 'OPTIONS') {
      return withCors(
        new Response(null, {
          status: 204,
          headers: {
            'access-control-allow-methods': 'GET,OPTIONS',
            'access-control-allow-headers': 'authorization,content-type',
            'access-control-max-age': '600',
          },
        }),
        origin,
        allowedOrigins,
      );
    }

    if (request.method !== 'GET') {
      return withCors(
        new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
          status: 405,
          headers: { 'content-type': 'application/json' },
        }),
        origin,
        allowedOrigins,
      );
    }

    try {
      enforceOriginAllowlist(origin, allowedOrigins);

      const remoteIp = resolveRemoteIp(request);
      enforceIpAllowlist(remoteIp, env.LEAD_VIEWER_IP_ALLOWLIST);

      const credentials = await verifyBasicAuth(request, env);

      const pagination = parsePagination(request.url);

      const [contact, whitepapers] = await Promise.all([
        queryContactSubmissions(env.LEAD_VIEWER_CONTACT_DB, pagination),
        queryWhitepaperRequests(env.LEAD_VIEWER_WHITEPAPER_DB, pagination),
      ]);

      const payload = {
        contact,
        whitepapers,
        audit: {
          actor: credentials.username,
          ip: remoteIp,
          userAgent: request.headers.get('user-agent') ?? null,
          requestId: crypto.randomUUID(),
        },
      };

      ctx.waitUntil(
        logAccess(env.LEAD_VIEWER_AUDIT_DB, {
          ...pagination,
          actor: credentials.username,
          ipAddress: remoteIp,
          userAgent: request.headers.get('user-agent'),
        }),
      );

      return withCors(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store',
          },
        }),
        origin,
        allowedOrigins,
      );
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const message =
        error instanceof HttpError
          ? error.message
          : 'Unexpected error while querying lead datasets';
      const response = new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
      if (status === 401) {
        const realm = env.LEAD_VIEWER_BASIC_REALM ?? 'Apotheon Lead Viewer';
        response.headers.set('www-authenticate', `Basic realm="${realm}", charset="UTF-8"`);
      }
      return withCors(response, origin, allowedOrigins);
    }
  },
};

function parsePagination(url: string): PaginationInput {
  const { searchParams } = new URL(url);
  const parsed = paginationSchema.safeParse({
    search: searchParams.get('search') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    perPage: searchParams.get('perPage') ?? undefined,
  });

  if (!parsed.success) {
    throw new HttpError(400, 'Invalid pagination or search parameters');
  }

  const { page, perPage, search } = parsed.data;
  return {
    page,
    perPage,
    search: search ?? null,
  };
}

function parseCsvList(input?: string): Set<string> {
  if (!input) return new Set();
  return new Set(
    input
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function withCors(
  response: Response,
  origin: string | null,
  allowedOrigins: Set<string>,
): Response {
  if (origin && (allowedOrigins.size === 0 || allowedOrigins.has(origin))) {
    response.headers.set('access-control-allow-origin', origin);
    response.headers.set('access-control-allow-credentials', 'true');
    response.headers.set('vary', 'origin');
  }
  return response;
}

function enforceOriginAllowlist(origin: string | null, allowedOrigins: Set<string>) {
  if (allowedOrigins.size === 0 || !origin) return;
  if (!allowedOrigins.has(origin)) {
    throw new HttpError(403, 'Origin not permitted');
  }
}

function enforceIpAllowlist(remoteIp: string | null, allowlist?: string) {
  if (!allowlist) return;
  const allowed = parseCsvList(allowlist);
  if (allowed.size === 0) return;
  if (!remoteIp || !allowed.has(remoteIp)) {
    throw new HttpError(403, 'IP address not authorized');
  }
}

function resolveRemoteIp(request: Request): string | null {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (!forwardedFor) return null;
  return forwardedFor.split(',')[0]?.trim() ?? null;
}

async function verifyBasicAuth(request: Request, env: LeadViewerEnv): Promise<ParsedCredentials> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith(BASIC_PREFIX)) {
    throw new HttpError(401, 'Authentication required');
  }

  const encoded = header.slice(BASIC_PREFIX.length);
  let decoded: string;
  try {
    decoded = atob(encoded);
  } catch {
    throw new HttpError(400, 'Invalid authorization encoding');
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    throw new HttpError(400, 'Malformed authorization header');
  }

  const credentials: ParsedCredentials = {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };

  const stored = parseCredentialMap(env.LEAD_VIEWER_BASIC_AUTH_USERS);
  if (stored.length === 0) {
    throw new HttpError(500, 'Basic auth user registry is not configured');
  }

  const match = stored.find((entry) => entry.username === credentials.username);
  if (!match) {
    throw unauthorized(env);
  }

  const providedHash = await sha256(credentials.password);
  if (!timingSafeEqual(match.hash, providedHash)) {
    throw unauthorized(env);
  }

  return credentials;
}

function unauthorized(env: LeadViewerEnv): HttpError {
  return new HttpError(
    401,
    env.LEAD_VIEWER_BASIC_REALM
      ? `Unauthorized (realm: ${env.LEAD_VIEWER_BASIC_REALM})`
      : 'Unauthorized',
  );
}

function parseCredentialMap(input?: string): StoredCredentialMap[] {
  if (!input) return [];
  return input
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [username, hash] = entry.split(':');
      if (!username || !hash) {
        throw new HttpError(500, 'Invalid credential map entry');
      }
      return { username, hash };
    });
}

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) {
    result |= expected.charCodeAt(index) ^ provided.charCodeAt(index);
  }
  return result === 0;
}

async function queryContactSubmissions(
  db: D1Database,
  pagination: PaginationInput,
): Promise<DatasetResult<ContactEntry>> {
  const filters = buildSearchFilters(pagination.search, [
    'name',
    'email',
    'company',
    'intent',
    'domain',
  ]);

  const totalStatement = db.prepare(
    `SELECT COUNT(*) as count
     FROM contact_submissions
     ${filters.where}`,
  );
  const totalResult = await totalStatement.bind(...filters.parameters).first<number>('count');
  const total = totalResult ?? 0;

  const queryStatement = db.prepare(
    `SELECT id, name, email, company, intent, message, domain, domain_classification,
            domain_flags, domain_rationale, ip_address, user_agent, created_at,
            source_url, utm
     FROM contact_submissions
     ${filters.where}
     ORDER BY datetime(created_at) DESC
     LIMIT ? OFFSET ?`,
  );

  const offset = (pagination.page - 1) * pagination.perPage;

  const results = await queryStatement
    .bind(...filters.parameters, pagination.perPage, offset)
    .all<RawContactRow>();

  const entries = (results.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    intent: row.intent,
    message: row.message,
    domain: row.domain,
    domainClassification: row.domain_classification,
    domainFlags: row.domain_flags,
    domainRationale: row.domain_rationale,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    sourceUrl: row.source_url ?? null,
    utm: row.utm ?? null,
  }));

  return {
    entries,
    pagination: buildPaginationMeta(pagination, total),
  };
}

async function queryWhitepaperRequests(
  db: D1Database,
  pagination: PaginationInput,
): Promise<DatasetResult<WhitepaperEntry>> {
  const filters = buildSearchFilters(pagination.search, [
    'name',
    'email',
    'company',
    'role',
    'whitepaper_slug',
    'whitepaper_title',
    'domain',
  ]);

  const totalStatement = db.prepare(
    `SELECT COUNT(*) as count
     FROM whitepaper_requests
     ${filters.where}`,
  );
  const totalResult = await totalStatement.bind(...filters.parameters).first<number>('count');
  const total = totalResult ?? 0;

  const queryStatement = db.prepare(
    `SELECT id, whitepaper_slug, whitepaper_title, name, email, company, role, justification,
            domain, domain_classification, domain_flags, domain_rationale, ip_address,
            user_agent, marketing_opt_in, signed_url_expires_at, asset_object_key,
            source_url, utm, created_at
     FROM whitepaper_requests
     ${filters.where}
     ORDER BY datetime(created_at) DESC
     LIMIT ? OFFSET ?`,
  );

  const offset = (pagination.page - 1) * pagination.perPage;
  const results = await queryStatement
    .bind(...filters.parameters, pagination.perPage, offset)
    .all<RawWhitepaperRow>();

  const entries = (results.results ?? []).map((row) => ({
    id: row.id,
    whitepaperSlug: row.whitepaper_slug,
    whitepaperTitle: row.whitepaper_title,
    name: row.name,
    email: row.email,
    company: row.company,
    role: row.role,
    justification: row.justification,
    domain: row.domain,
    domainClassification: row.domain_classification,
    domainFlags: row.domain_flags,
    domainRationale: row.domain_rationale,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    marketingOptIn: Boolean(row.marketing_opt_in),
    signedUrlExpiresAt: row.signed_url_expires_at,
    assetObjectKey: row.asset_object_key,
    sourceUrl: row.source_url ?? null,
    utm: row.utm ?? null,
    createdAt: row.created_at,
  }));

  return {
    entries,
    pagination: buildPaginationMeta(pagination, total),
  };
}

function buildSearchFilters(
  search: string | null,
  columns: string[],
): {
  where: string;
  parameters: string[];
} {
  if (!search) {
    return { where: '', parameters: [] };
  }

  const like = `%${search.toLowerCase()}%`;
  const conditions = columns.map((column) => `lower(${column}) LIKE ?`).join(' OR ');
  return {
    where: `WHERE ${conditions}`,
    parameters: Array.from({ length: columns.length }, () => like),
  };
}

function buildPaginationMeta(pagination: PaginationInput, total: number) {
  const totalPages = Math.max(1, Math.ceil(total / pagination.perPage));
  const currentPage = Math.min(Math.max(1, pagination.page), totalPages);
  return {
    page: currentPage,
    perPage: pagination.perPage,
    total,
    totalPages,
  };
}

async function logAccess(
  db: D1Database,
  details: PaginationInput & { actor: string; ipAddress: string | null; userAgent: string | null },
): Promise<void> {
  const statement = db.prepare(
    `INSERT INTO lead_viewer_access_log
      (id, actor, ip_address, user_agent, search_term, page, per_page, requested_datasets, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))`,
  );

  await statement
    .bind(
      crypto.randomUUID(),
      details.actor,
      details.ipAddress,
      details.userAgent,
      details.search,
      details.page,
      details.perPage,
      'contact,whitepapers',
    )
    .run();
}
