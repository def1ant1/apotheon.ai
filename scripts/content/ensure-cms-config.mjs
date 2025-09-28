import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import YAML from 'yaml';

/**
 * The CMS configuration is generated instead of committed manually so the
 * collections stay in sync with the Astro content contracts. Editors receive a
 * strongly typed experience without engineers needing to remember to touch two
 * files during schema updates. The script is idempotent and happily runs on
 * every `npm run ensure:*` invocation.
 */
async function main() {
  const configUrl = new URL('../../public/admin/config.yml', import.meta.url);
  const configDir = dirname(fileURLToPath(configUrl));

  await mkdir(configDir, { recursive: true });

  const cmsConfig = buildConfig();
  const serialized = YAML.stringify(cmsConfig, {
    indent: 2,
    lineWidth: 120,
    sortMapEntries: false,
  });

  if (existsSync(configUrl)) {
    const current = await readFile(configUrl, 'utf8');
    if (current.trim() === serialized.trim()) {
      return;
    }
  }

  await writeFile(configUrl, serialized, 'utf8');
}

/**
 * Constructs the object representation of `config.yml`. Keeping the structure in
 * JavaScript lets us annotate every field with inline commentary and leverage
 * the same schema metadata the Astro collections expose.
 */
function buildConfig() {
  const sharedEditorialHints = Object.freeze({
    workflowStatus: 'editorial_workflow',
    draftField: 'draft',
    identityProvider: 'Netlify Identity',
  });

  return {
    backend: {
      /**
       * `git-gateway` keeps auth delegated to Netlify Identity so security teams
       * can manage access centrally instead of distributing repo-level tokens.
       */
      name: 'git-gateway',
      branch: process.env.DECAP_CMS_BRANCH ?? 'main',
    },
    site_url: process.env.DECAP_CMS_SITE_URL ?? 'https://apotheon.ai',
    logo_url: '/favicon.svg',
    publish_mode: sharedEditorialHints.workflowStatus,
    media_folder: process.env.DECAP_CMS_MEDIA_FOLDER ?? 'public/uploads/cms',
    public_folder: process.env.DECAP_CMS_PUBLIC_FOLDER ?? '/uploads/cms',
    identity_url: process.env.DECAP_IDENTITY_URL ?? '/.netlify/identity',
    local_backend: false,
    collections: [buildBlogCollection(), buildMarketingCollection(sharedEditorialHints)],
  };
}

function buildBlogCollection() {
  return {
    name: 'blog',
    label: 'Blog',
    label_singular: 'Blog Article',
    folder: 'src/content/blog',
    extension: 'mdx',
    format: 'frontmatter',
    create: true,
    slug: '{{slug}}',
    preview_path: 'blog/{{slug}}/',
    identifier_field: 'title',
    summary: '{{title}} — {{publishDate}}',
    sortable_fields: ['publishDate', 'title'],
    fields: [
      {
        name: 'title',
        label: 'Title',
        widget: 'string',
        hint: 'Human readable page title surfaced across the marketing site.',
      },
      {
        name: 'description',
        label: 'Meta Description',
        widget: 'text',
        hint: 'Limited to 160 characters to satisfy SEO + social truncation rules.',
        pattern: ['^.{1,160}$', 'Descriptions must be between 1 and 160 characters.'],
      },
      {
        name: 'publishDate',
        label: 'Publish Date',
        widget: 'datetime',
        hint: 'ISO publication date used for ordering, RSS feeds, and JSON-LD.',
        format: 'YYYY-MM-DD',
        time_format: false,
      },
      {
        name: 'updatedDate',
        label: 'Updated Date',
        widget: 'datetime',
        required: false,
        hint: 'Optional refresh date surfaced in the author bio + structured data.',
        format: 'YYYY-MM-DD',
        time_format: false,
      },
      {
        name: 'heroImage',
        label: 'Hero Image',
        widget: 'image',
        media_folder: 'public/images/blog',
        public_folder: '/images/blog',
        hint: 'Processed via astro:assets; supply high-resolution assets.',
      },
      {
        name: 'heroImageAlt',
        label: 'Hero Image Alt Text',
        widget: 'string',
        hint: 'Plain-language description that doubles as on-page caption text.',
      },
      {
        name: 'tags',
        label: 'Tags',
        widget: 'list',
        min: 1,
        field: {
          name: 'tag',
          label: 'Tag',
          widget: 'string',
          hint: 'Lowercase, kebab-case taxonomy token powering site filters.',
        },
      },
      {
        name: 'estimatedReadingMinutes',
        label: 'Estimated Reading Time (minutes)',
        widget: 'number',
        value_type: 'int',
        min: 1,
        step: 1,
      },
      {
        name: 'author',
        label: 'Author',
        widget: 'object',
        collapsed: false,
        fields: [
          {
            name: 'name',
            label: 'Name',
            widget: 'string',
          },
          {
            name: 'title',
            label: 'Title',
            widget: 'string',
            required: false,
          },
          {
            name: 'avatar',
            label: 'Avatar',
            widget: 'image',
            required: false,
            hint: 'Optional portrait rendered via astro:assets.',
          },
          {
            name: 'bio',
            label: 'Short Bio',
            widget: 'text',
            hint: 'Displayed beneath the article; keep under 320 characters.',
          },
          {
            name: 'links',
            label: 'Links',
            widget: 'list',
            allow_add: true,
            collapsed: true,
            fields: [
              { name: 'label', label: 'Label', widget: 'string' },
              { name: 'url', label: 'URL', widget: 'string', pattern: ['^https?://', 'Must be an absolute URL.'] },
              {
                name: 'rel',
                label: 'rel Attribute Override',
                widget: 'string',
                required: false,
                hint: 'Optional rel attribute customization for compliance contexts.',
              },
            ],
          },
        ],
      },
      {
        name: 'openGraph',
        label: 'Open Graph Artwork',
        widget: 'object',
        collapsed: true,
        fields: [
          {
            name: 'image',
            label: 'Image Path',
            widget: 'image',
            hint: 'Absolute or relative path to the social card asset.',
          },
          {
            name: 'alt',
            label: 'Alternative Text',
            widget: 'string',
            hint: 'Narrative surfaced in Schema.org metadata + screen readers.',
          },
          {
            name: 'generatorRequestId',
            label: 'OG Generator Request ID',
            widget: 'string',
            required: false,
            hint: 'Optional correlation ID once the OG image Worker ships.',
          },
        ],
      },
      {
        name: 'draft',
        label: 'Draft',
        widget: 'boolean',
        default: false,
        hint: 'Drafts stay in preview builds only; production excludes them automatically.',
      },
      {
        name: 'body',
        label: 'Body',
        widget: 'markdown',
        buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'quote', 'bulleted-list', 'numbered-list'],
      },
    ],
  };
}

function buildMarketingCollection(sharedEditorialHints) {
  return {
    name: 'marketing',
    label: 'Marketing Pages',
    label_singular: 'Marketing Entry',
    folder: 'src/content/marketing',
    extension: 'mdx',
    format: 'frontmatter',
    create: true,
    slug: '{{slug}}',
    preview_path: 'marketing/{{slug}}/',
    identifier_field: 'title',
    summary: '{{title}} — order: {{order}}',
    sortable_fields: ['order', 'title'],
    fields: [
      { name: 'title', label: 'Title', widget: 'string' },
      {
        name: 'summary',
        label: 'Summary',
        widget: 'text',
        required: false,
        hint: 'Optional excerpt surfaced in list pages + search results.',
      },
      {
        name: 'heroCtaLabel',
        label: 'Hero CTA Label',
        widget: 'string',
        required: false,
      },
      {
        name: 'order',
        label: 'Navigation Order',
        widget: 'number',
        value_type: 'int',
        default: 0,
        hint: 'Lower numbers bubble to the top of navigation menus.',
      },
      {
        name: 'featured',
        label: 'Featured',
        widget: 'boolean',
        default: false,
        hint: 'Toggles homepage highlights without touching layout code.',
      },
      {
        name: sharedEditorialHints.draftField,
        label: 'Draft',
        widget: 'boolean',
        default: false,
      },
      buildNestedGroup('vision', 'Vision Narrative', [
        { name: 'headline', label: 'Headline', widget: 'string' },
        { name: 'narrative', label: 'Narrative', widget: 'markdown' },
      ]),
      buildNestedGroup('market', 'Market Focus', [
        { name: 'headline', label: 'Headline', widget: 'string' },
        {
          name: 'verticals',
          label: 'Verticals',
          widget: 'list',
          field: { name: 'vertical', label: 'Vertical', widget: 'string' },
        },
      ]),
      buildNestedGroup('regulatoryStance', 'Regulatory Stance', [
        { name: 'headline', label: 'Headline', widget: 'string' },
        {
          name: 'commitments',
          label: 'Commitments',
          widget: 'list',
          field: { name: 'commitment', label: 'Commitment', widget: 'string' },
        },
      ]),
      buildNestedGroup('roadmap', 'Roadmap', [
        { name: 'headline', label: 'Headline', widget: 'string' },
        {
          name: 'milestones',
          label: 'Milestones',
          widget: 'list',
          field: { name: 'milestone', label: 'Milestone', widget: 'string' },
        },
      ]),
      buildNestedGroup('callsToAction', 'Calls To Action', [
        { name: 'primaryLabel', label: 'Primary Label', widget: 'string' },
        { name: 'primaryHref', label: 'Primary Href', widget: 'string' },
        { name: 'secondaryLabel', label: 'Secondary Label', widget: 'string' },
        {
          name: 'secondarySlug',
          label: 'Secondary Slug',
          widget: 'string',
          required: false,
        },
      ]),
      buildNestedGroup('investorBrief', 'Investor Brief', [
        { name: 'title', label: 'Document Title', widget: 'string' },
        { name: 'objectKey', label: 'Object Key', widget: 'string' },
        { name: 'summary', label: 'Summary', widget: 'text' },
        {
          name: 'lastReviewedBy',
          label: 'Last Reviewed By (Email)',
          widget: 'string',
          pattern: ['^[^@\s]+@[^@\s]+\.[^@\s]+$', 'Must be a valid email address.'],
        },
      ]),
      {
        name: 'body',
        label: 'Body',
        widget: 'markdown',
        buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'quote', 'bulleted-list', 'numbered-list'],
      },
    ],
  };
}

function buildNestedGroup(name, label, fields) {
  return {
    name,
    label,
    widget: 'object',
    collapsed: true,
    required: false,
    fields,
  };
}

await main();
