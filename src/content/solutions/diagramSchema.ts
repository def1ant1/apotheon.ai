import { z } from 'zod';

/**
 * Shared diagram metadata schema reused by Astro content collections and design tooling.
 * Defining this contract with vanilla Zod keeps bundlers like Ladle from trying to resolve
 * `astro:content` while still guaranteeing the same validation semantics across environments.
 */
export const diagramSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/u)
      .describe(
        'Slug that maps directly to assets/solutions-diagrams/raw/<slug>.svg and the optimized public asset',
      ),
    alt: z
      .string()
      .min(1)
      .describe('Concise alt text explaining what the architecture diagram communicates'),
    caption: z
      .string()
      .min(1)
      .describe('Supporting caption surfaced below the diagram for additional context'),
  })
  .describe('Accessible architecture diagram metadata surfaced mid-page');

/**
 * Lightweight slice of the full solution frontmatter exported for Ladle + test environments.
 * This schema purposefully mirrors the Astro collection definition so authors get identical
 * validation whether running stories, unit tests, or the content pipeline.
 */
export const solutionDiagramFrontmatterSchema = z
  .object({
    title: z.string().min(1),
    diagram: diagramSchema,
  })
  .describe('Subset of solution frontmatter used by design tooling stories');
