/**
 * Domain fixtures maintained in-source so both the frontend and Workers can
 * consistently vet inbound contact submissions. Enterprise rollouts tend to be
 * global and fast moving, meaning that treating this as code (rather than an
 * external spreadsheet) keeps validation auditable alongside application
 * history.
 */
export const HIGH_RISK_DOMAINS: readonly string[] = [
  // Disposable inbox providers that routinely evade traditional SPF/DMARC checks.
  '10minutemail.com',
  'discard.email',
  'guerrillamail.com',
  'mailinator.com',
  'spamgourmet.com',
  'temp-mail.org',
  'yopmail.com',
  // Free mail providers that rarely correlate with enterprise buyers.
  'gmail.com',
  'hotmail.com',
  'icloud.com',
  'outlook.com',
  'pm.me',
  'protonmail.com',
  'proton.me',
  'yahoo.com',
];

export const HAPPY_PATH_CORPORATE_DOMAINS: readonly string[] = [
  // Apotheon first-party + sandbox partner tenants.
  'apotheon.ai',
  'labs.apotheon.ai',
  // Reference enterprise domains representing the qualification profile RevOps expects.
  'contoso-enterprise.com',
  'globex.corp',
  'initech.example',
  'umbrella-enterprises.com',
];

export const SUSPICIOUS_TLDS: readonly string[] = ['click', 'gq', 'link', 'xyz', 'zip'];
