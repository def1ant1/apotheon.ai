# Whitepaper managed assets

These PDFs are generated automatically from the MDX whitepaper source files via
`scripts/content/generate-whitepapers.ts`. Do not edit the binaries by hand—run
`npm run ensure:whitepapers` after updating MDX copy to refresh the rendered
artifacts, checksums, and manifest metadata. The `.gitignore` explicitly excludes
`*.pdf` under this directory; local runs will materialize fresh assets for
validation, while commits should only capture manifest/frontmatter updates.
