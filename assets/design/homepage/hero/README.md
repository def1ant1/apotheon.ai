# Homepage Hero Golden Asset

The files in this directory are the canonical "last known good" renderings for the homepage hero. They backstop the automation pipeline when the procedural renderer is unavailable.

- `managed-assets.json` — base64-encoded binaries + SHA-256 checksums consumed by `scripts/content/ensure-homepage-hero-media.ts`
- `hero-render-context.json` — capture of the renderer inputs / palette
- `npm run ensure:homepage-hero-media -- --refresh-managed-ledger` — helper command that rebuilds `managed-assets.json` from the rendered PNG/AVIF/WebP in your working directory.

> Update the PNG first, then regenerate the derivatives, run the ledger refresh command above, and commit the entire directory. Never commit binary media directly—everything must live inside `managed-assets.json`.
