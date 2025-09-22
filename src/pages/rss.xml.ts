import { getCollection } from 'astro:content';

import {
  resolveOgImage,
  sortBlogPostsByPublishDate,
  type BlogCollectionEntry,
} from '../utils/blog';

import type { APIRoute } from 'astro';

export const prerender = true;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = async ({ site }) => {
  const entries: BlogCollectionEntry[] = await getCollection('blog');
  const posts = sortBlogPostsByPublishDate(
    entries.filter((entry) => !entry.data.draft),
    'desc',
  );
  const siteUrl = site ?? new URL('https://apotheon.ai');

  const renderedItems = await Promise.all(
    posts.map(async (entry) => {
      const url = new URL(`/blog/${entry.slug}/`, siteUrl).href;
      const { url: ogImageUrl } = await resolveOgImage(entry, siteUrl.href);
      return `    <item>
      <title>${escapeXml(entry.data.title)}</title>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <description>${escapeXml(entry.data.description)}</description>
      <pubDate>${entry.data.publishDate.toUTCString()}</pubDate>
      <enclosure url="${escapeXml(ogImageUrl)}" type="image/svg+xml" />
    </item>`;
    }),
  );

  const items = renderedItems.join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Apotheon.ai Blog</title>
    <link>${escapeXml(siteUrl.href)}</link>
    <description>Enterprise AI governance, delivery, and platform engineering insights from the Apotheon.ai team.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
