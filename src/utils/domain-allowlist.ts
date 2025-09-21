import {
  HAPPY_PATH_CORPORATE_DOMAINS,
  HIGH_RISK_DOMAINS,
  SUSPICIOUS_TLDS,
} from './domain-fixtures';

export interface DomainAnalysisFlags {
  disposable: boolean;
  freeProvider: boolean;
  suspiciousTld: boolean;
  allowlisted: boolean;
  blocklisted: boolean;
}

export type DomainClassification = 'allow' | 'review' | 'block';

export interface DomainAnalysisResult {
  domain: string;
  classification: DomainClassification;
  flags: DomainAnalysisFlags;
  rationale: string[];
}

export interface DomainAnalysisOptions {
  additionalBlocklist?: string[];
  additionalAllowlist?: string[];
}

const FREE_PROVIDER_SET = new Set([
  'gmail.com',
  'hotmail.com',
  'icloud.com',
  'outlook.com',
  'proton.me',
  'protonmail.com',
  'yahoo.com',
]);

const HIGH_RISK_SET = new Set(HIGH_RISK_DOMAINS.map((domain) => domain.toLowerCase()));
const HAPPY_PATH_SET = new Set(HAPPY_PATH_CORPORATE_DOMAINS.map((domain) => domain.toLowerCase()));
const SUSPICIOUS_TLD_SET = new Set(SUSPICIOUS_TLDS.map((tld) => tld.toLowerCase()));

/**
 * Extracts the domain portion of an email address. Guarding for malformed input
 * keeps the downstream Worker from tripping over `undefined` slices while still
 * letting the caller report actionable feedback to the user.
 */
export function extractDomain(email: string): string | null {
  const candidate = email.trim().toLowerCase();
  if (!candidate.includes('@')) return null;

  const [, domain] = candidate.split('@');
  if (!domain) return null;

  return domain;
}

/**
 * Evaluate whether the provided email domain should be accepted outright,
 * blocked as obviously risky, or flagged for secondary verification like an MX
 * lookup. The flags make it straightforward for the Worker to store auditable
 * metadata without re-deriving the classification.
 */
export function analyzeDomain(
  emailOrDomain: string,
  options: DomainAnalysisOptions = {},
): DomainAnalysisResult {
  const domain = emailOrDomain.includes('@') ? extractDomain(emailOrDomain) : emailOrDomain;
  if (!domain) {
    return {
      domain: '',
      classification: 'block',
      flags: {
        disposable: false,
        freeProvider: false,
        suspiciousTld: false,
        allowlisted: false,
        blocklisted: true,
      },
      rationale: ['Email address is malformed; unable to determine domain.'],
    };
  }

  const normalizedDomain = domain.trim().toLowerCase();
  const blocklist = new Set(
    (options.additionalBlocklist ?? []).map((value) => value.toLowerCase()),
  );
  const allowlist = new Set(
    (options.additionalAllowlist ?? []).map((value) => value.toLowerCase()),
  );

  const domainParts = normalizedDomain.split('.');
  const tld = domainParts.at(-1) ?? '';

  const disposable = HIGH_RISK_SET.has(normalizedDomain) || blocklist.has(normalizedDomain);
  const freeProvider = FREE_PROVIDER_SET.has(normalizedDomain);
  const suspiciousTld = SUSPICIOUS_TLD_SET.has(tld);
  const allowlisted = HAPPY_PATH_SET.has(normalizedDomain) || allowlist.has(normalizedDomain);
  const blocklisted = disposable || blocklist.has(normalizedDomain);

  const rationale: string[] = [];

  if (allowlisted) {
    rationale.push('Domain is on the RevOps allowlist.');
  }

  if (blocklisted) {
    rationale.push('Domain is blocklisted due to high abuse signals.');
  }

  if (freeProvider && !allowlisted) {
    rationale.push('Free mail providers require manual screening.');
  }

  if (suspiciousTld && !allowlisted) {
    rationale.push('Top-level domain associated with disposable inbox services.');
  }

  if (!rationale.length) {
    rationale.push('Domain not recognized; subject to secondary verification.');
  }

  let classification: DomainClassification = 'review';

  if (allowlisted && !blocklisted) {
    classification = 'allow';
  } else if (blocklisted) {
    classification = 'block';
  }

  return {
    domain: normalizedDomain,
    classification,
    flags: {
      disposable,
      freeProvider,
      suspiciousTld,
      allowlisted,
      blocklisted,
    },
    rationale,
  };
}

export interface MxLookupResult {
  hasMxRecords: boolean;
  records: string[];
}

/**
 * Performs a DNS-over-HTTPS MX lookup using Cloudflare's resolver. Workers can
 * call this opportunistically when the allowlist analysis returns `review`,
 * giving the platform another data point without blocking the happy path.
 */
export async function lookupMxRecords(
  domain: string,
  fetcher: typeof fetch = fetch,
): Promise<MxLookupResult> {
  const endpoint = new URL('https://cloudflare-dns.com/dns-query');
  endpoint.searchParams.set('name', domain);
  endpoint.searchParams.set('type', 'MX');

  const response = await fetcher(endpoint.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/dns-json',
    },
  });

  if (!response.ok) {
    return { hasMxRecords: false, records: [] };
  }

  const data: { Answer?: Array<{ data: string }> } = await response.json();
  const records = data.Answer?.map((entry) => entry.data) ?? [];

  return {
    hasMxRecords: records.length > 0,
    records,
  };
}

/**
 * Utility used by both the Worker and the client to decide whether the MX
 * lookup should execute. Because MX checks add latency, we only trigger the
 * network call when the analysis landed on a review state.
 */
export function shouldPerformMxLookup(result: DomainAnalysisResult): boolean {
  return result.classification === 'review';
}
