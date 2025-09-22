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
  const feedId = new URL('/atom.xml', siteUrl).href;

  const updated = posts[0]?.data.updatedDate ?? posts[0]?.data.publishDate ?? new Date();

  const renderedItems = await Promise.all(
    posts.map(async (entry) => {
      const url = new URL(`/blog/${entry.slug}/`, siteUrl).href;
      const { url: ogImageUrl, alt: ogImageAlt } = await resolveOgImage(entry, siteUrl.href);
      return `  <entry>
    <id>${escapeXml(url)}</id>
    <title>${escapeXml(entry.data.title)}</title>
    <link href="${escapeXml(url)}" />
    <updated>${entry.data.updatedDate?.toISOString() ?? entry.data.publishDate.toISOString()}</updated>
    <published>${entry.data.publishDate.toISOString()}</published>
    <summary>${escapeXml(entry.data.description)}</summary>
    <content type="html">${escapeXml(entry.data.description)}</content>
    <link rel="enclosure" type="image/svg+xml" href="${escapeXml(ogImageUrl)}" title="${escapeXml(ogImageAlt)}" />
  </entry>`;
    }),
  );

  const items = renderedItems.join('\n');

  const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(feedId)}</id>
  <title>Apotheon.ai Blog</title>
  <link href="${escapeXml(feedId)}" rel="self" />
  <link href="${escapeXml(siteUrl.href)}" />
  <updated>${updated.toISOString()}</updated>
  <author>
    <name>Apotheon.ai Editorial</name>
  </author>
${items}
</feed>`;

  return new Response(atom, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  });
};
