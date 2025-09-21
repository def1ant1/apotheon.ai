declare module '../../config/seo/manifest.mjs' {
  export const SEO_MANIFEST: {
    site: URL | string;
    sitemap: {
      entryLimit: number;
      cache: {
        changeFrequency: string;
        priority: number;
      };
    };
    routes: {
      exclusionPatterns: RegExp[];
      criticalPaths: string[];
    };
    robots: {
      environmentKeys: string[];
      policies: Record<string, Array<{ userAgent: string; allow?: string[]; disallow?: string[] }>>;
    };
  };
  export const SITEMAP_INDEX_BASENAME: string;
  export function resolveDeploymentStage(env?: NodeJS.ProcessEnv): string;
  export function getSitemapIndexUrl(manifest?: typeof SEO_MANIFEST): string;
  export function createRouteExclusionPredicate(patterns?: RegExp[]): (path: string) => boolean;
  export function resolveRobotsPolicies(stage?: string): Array<{
    userAgent: string;
    allow?: string[];
    disallow?: string[];
  }>;
}
