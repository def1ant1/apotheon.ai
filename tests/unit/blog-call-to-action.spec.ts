import { describe, expect, it } from 'vitest';

import { renderBlogCtaMarkup } from '../../src/components/blog/call-to-action';

describe('renderBlogCtaMarkup', () => {
  it('returns hydrated markup for valid CTA metadata', () => {
    const markup = renderBlogCtaMarkup({
      eyebrow: 'Download',
      title: 'Review the AIOS blueprint',
      description: 'Pair the article with our diligence-ready playbook.',
      primary: {
        label: 'Download now',
        href: '/about/white-papers/#whitepaper-request',
      },
      secondary: {
        label: 'Book a briefing',
        href: '/about/contact/?team=platform&intent=architecture-briefing',
      },
    });

    expect(markup).toBeTruthy();

    const container = document.createElement('section');
    container.innerHTML = markup ?? '';
    const heading = container.querySelector('#blog-cta-heading');
    const primary = container.querySelector('[data-qa="blog-cta-primary"]');
    const secondary = container.querySelector('[data-qa="blog-cta-secondary"]');

    expect(heading?.textContent).toContain('Review the AIOS blueprint');
    expect(primary?.getAttribute('href')).toBe('/about/white-papers/#whitepaper-request');
    expect(secondary?.getAttribute('href')).toBe(
      '/about/contact/?team=platform&intent=architecture-briefing',
    );
  });

  it('returns null when the CTA metadata is incomplete', () => {
    const markup = renderBlogCtaMarkup({
      title: 'Missing link example',
      primary: {
        label: 'Fix me',
        href: '   ',
      },
    });

    expect(markup).toBeNull();
  });

  it('omits optional metadata when secondary links are absent', () => {
    const markup = renderBlogCtaMarkup({
      title: 'Single link CTA',
      primary: {
        label: 'Download now',
        href: '/about/white-papers/#whitepaper-request',
      },
    });

    expect(markup).toBeTruthy();

    const container = document.createElement('section');
    container.innerHTML = markup ?? '';

    expect(container.querySelector('[data-qa="blog-cta-secondary"]')).toBeNull();
    expect(container.querySelector('[data-qa="blog-cta-primary"]')).not.toBeNull();
  });

  it('escapes HTML entities to prevent injection', () => {
    const markup = renderBlogCtaMarkup({
      eyebrow: '<script>alert(1)</script>',
      title: '<script>alert(2)</script>',
      description: '<img src=x onerror=alert(3)>',
      primary: {
        label: 'Click <me>',
        href: 'https://example.com/path?<script>',
      },
    });

    expect(markup).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(markup).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(markup).toContain('&lt;img src=x onerror=alert(3)&gt;');
    expect(markup).toContain('href=&quot;https://example.com/path?&lt;script&gt;&quot;');
  });

  it('rejects blocked URL protocols to avoid JavaScript execution', () => {
    const markup = renderBlogCtaMarkup({
      title: 'Protocol safety',
      primary: {
        label: 'Do not render',
        href: 'javascript:alert(1)',
      },
    });

    expect(markup).toBeNull();
  });
});
