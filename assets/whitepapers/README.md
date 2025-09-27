# Whitepaper managed assets

These PDFs are generated automatically from the MDX whitepaper source files via
`scripts/content/generate-whitepapers.ts`. Do not edit the binaries by hand—run
`npm run ensure:whitepapers` after updating MDX copy to refresh the rendered
artifacts, checksums, and manifest metadata. The `.gitignore` explicitly excludes
`*.pdf` under this directory; local runs will materialize fresh assets for
validation, while commits should only capture manifest/frontmatter updates.

`managed-assets.json` is a managed ledger that stores base64-encoded production
PDFs alongside their SHA-256 checksums, page counts, and provenance notes. The
ensure script hydrates these binaries automatically whenever Playwright is
unavailable, guaranteeing zero-touch developer environments and CI can still
validate integrity. Playwright remains the source of truth—regenerate the PDFs
with the generator first, then refresh the ledger so it mirrors production.
