export interface SolutionDiagramMetadata {
  slug: string;
  alt: string;
  caption: string;
}

export interface DiagramAccessibilityState {
  captionId: string;
  inlineAttributes: Record<string, string>;
  imageAttributes: Record<string, string>;
}

/**
 * Centralizes accessibility metadata so Vitest can exercise the same logic rendered by the Astro
 * component. Keeping this helper separate avoids brittle string matching inside tests and documents
 * how alt text + captions pair together for assistive tech.
 */
export function buildDiagramAccessibilityState(
  diagram: SolutionDiagramMetadata,
  id: string,
): DiagramAccessibilityState {
  const captionId = `${id}-caption`;

  return {
    captionId,
    inlineAttributes: {
      role: 'img',
      'aria-label': diagram.alt,
      'aria-describedby': captionId,
    },
    imageAttributes: {
      'aria-describedby': captionId,
      loading: 'lazy',
      decoding: 'async',
    },
  } satisfies DiagramAccessibilityState;
}
