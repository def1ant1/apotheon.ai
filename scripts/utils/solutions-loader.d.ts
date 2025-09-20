/* eslint-disable -- Type-centric declaration file feeding TypeScript consumers of the loader. */

export interface LoadedSolutionEntry {
  slug: string;
  data: import('../../src/content/solutions').SolutionEntry['data'];
  sourcePath: string;
}

export interface LoadSolutionFrontmatterOptions {
  includeDrafts?: boolean;
}

export declare function loadSolutionFrontmatter(
  options?: LoadSolutionFrontmatterOptions,
): LoadedSolutionEntry[];

export default loadSolutionFrontmatter;
