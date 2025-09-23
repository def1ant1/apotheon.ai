import { describe, it } from 'vitest';

import { expectAstroElementAttributes } from '../utils/accessibility';

describe('astro component landmarks', () => {
  it('SiteHeader exposes a banner landmark and skip link', async () => {
    await expectAstroElementAttributes('src/components/navigation/SiteHeader.astro', 'header', {
      name: 'role',
      value: 'banner',
    });
    await expectAstroElementAttributes('src/components/navigation/SiteHeader.astro', 'header', {
      name: 'aria-label',
      value: 'Primary site header',
    });
    await expectAstroElementAttributes('src/components/navigation/SiteHeader.astro', 'a', {
      name: 'href',
      value: '#main',
    });
  });

  it('SiteFooter keeps the contentinfo region labelled', async () => {
    await expectAstroElementAttributes('src/components/navigation/SiteFooter.astro', 'footer', {
      name: 'role',
      value: 'contentinfo',
    });
    await expectAstroElementAttributes('src/components/navigation/SiteFooter.astro', 'section', {
      name: 'aria-labelledby',
      value: 'footer-contact',
    });
  });

  it('MarketingShell names the marketing content region', async () => {
    await expectAstroElementAttributes('src/components/marketing/MarketingShell.astro', 'section', {
      name: 'aria-label',
      expressionContains: 'Marketing content:',
    });
  });

  it('MarketingCtaRow links its region to the heading id', async () => {
    await expectAstroElementAttributes(
      'src/components/marketing/MarketingCtaRow.astro',
      'section',
      {
        name: 'aria-labelledby',
        expressionContains: 'headingId',
      },
    );
    await expectAstroElementAttributes('src/components/marketing/MarketingCtaRow.astro', 'h2', {
      name: 'id',
      expressionContains: 'headingId',
    });
  });
});
