import { useMemo } from 'react';
import { parse } from 'yaml';

import { solutionDiagramFrontmatterSchema } from '../../content/solutions/diagramSchema';

import type { Meta, Story } from '@ladle/react';

interface DiagramMetadata {
  slug: string;
  alt: string;
  caption: string;
  title: string;
}

const meta: Meta = {
  title: 'Solutions/Architecture Diagrams',
};

export default meta;

const solutionFrontmatterSources = import.meta.glob('../../content/solutions/*.mdx', {
  eager: true,
  as: 'raw',
}) satisfies Record<string, string>;

const optimizedDiagrams = import.meta.glob('../../public/static/diagrams/solutions/*.svg', {
  eager: true,
  as: 'raw',
}) satisfies Record<string, string>;

function useDiagramMetadata(): DiagramMetadata[] {
  return useMemo(() => {
    return Object.entries(solutionFrontmatterSources)
      .filter(([path]) => path.endsWith('.mdx'))
      .map(([, source]) => {
        const match = /^---\n([\s\S]*?)\n---/u.exec(String(source));
        if (!match) {
          throw new Error('Solution entry missing frontmatter; unable to build diagram story.');
        }
        const parsed = solutionDiagramFrontmatterSchema.parse(parse(match[1]));
        return {
          slug: parsed.diagram.slug,
          alt: parsed.diagram.alt,
          caption: parsed.diagram.caption,
          title: parsed.title,
        } satisfies DiagramMetadata;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, []);
}

export const DiagramGallery: Story = () => {
  const diagrams = useDiagramMetadata();

  return (
    <article className="token-story">
      <header>
        <h1 className="token-story__title">Solution architecture diagrams</h1>
        <p className="token-story__lede">
          Automation regenerates these assets via <code>npm run diagrams:build</code>. This story
          reads the MDX frontmatter so designers can validate alt text, captions, and optimized SVG
          output without grepping the repository.
        </p>
      </header>

      <section className="grid gap-8 md:grid-cols-2">
        {diagrams.map((diagram) => {
          const svgSource = String(
            optimizedDiagrams[`../../public/static/diagrams/solutions/${diagram.slug}.svg`] ?? '',
          );

          return (
            <figure
              key={diagram.slug}
              className="flex flex-col gap-4 rounded-2xl border border-slate-700/60 bg-slate-950/60 p-6"
            >
              <div
                className="[&>svg]:h-auto [&>svg]:w-full"
                role="img"
                aria-label={diagram.alt}
                dangerouslySetInnerHTML={{
                  __html: (svgSource ?? '').replace(/^<!--.*?-->\s*/su, ''),
                }}
              />
              <figcaption className="text-sm text-slate-200">
                <strong className="block text-white">{diagram.title}</strong>
                <span className="block text-slate-300">{diagram.caption}</span>
              </figcaption>
            </figure>
          );
        })}
      </section>

      <section className="details-explainer">
        <details open>
          <summary>Maintaining diagram assets</summary>
          <ul>
            <li>
              Edit source artwork under <code>assets/solutions-diagrams/raw/</code> and rerun{' '}
              <code>npm run diagrams:build</code> to regenerate the optimized exports.
            </li>
            <li>
              Update alt text and captions directly in the MDX frontmatter so every surface—pages,
              tests, and this gallery—stay in sync.
            </li>
            <li>
              The Vitest suite asserts diagram metadata and the Playwright spec checks accessibility
              labels, ensuring automation protects against regressions.
            </li>
          </ul>
        </details>
      </section>
    </article>
  );
};

Object.assign(DiagramGallery, {
  storyName: 'Diagram gallery',
  meta: { width: 'full' },
});
