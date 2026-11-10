# Research data and attribution

Research datasets retain their own source and licensing metadata. The website's build combines them without changing their provenance.

- `research-openalex.json` and `research-expanded.json` contain OpenAlex-derived records with CC0 metadata. Separate manually researched sources remain cited in those files.
- `research-zbmath.json`, when generated from actual collection checkpoints, is a derived zbMATH Open graph distributed with **CC BY-SA 4.0** attribution. Preserve its attribution, license link, modification notice and record-specific provenance when sharing or adapting that graph. This dataset is not labeled CC0.
- Manual research files cite the public publications, CVs and institutional records used for each relationship or appointment. They are separate from index-derived records.
- `department-notes-research.json` and `research-department-editorial.json` contain sourced editorial department summaries. `scripts/build-department-notes.mjs` combines them with the preserved dossiers and `programs-international.json` to generate `department-notes.js`; the second editorial file takes precedence. All 174 cards are covered: 51 researched summaries, 116 dossier syntheses, and seven program-structure syntheses. Preserve each summary’s sources, date, basis, and scope when reusing it.
- `programs-international.json` supplies ten separate degree routes. Their country arrays, course structures, admissions rules, and funding remain separate from department-overview records. `src/core/geography.js` maps legacy region/consortium selections to individual countries; an unknown setting is not assumed rural.

zbMATH attribution: **Author disambiguation and classification data: zbMATH Open, FIZ Karlsruhe / European Mathematical Society / Heidelberg Academy of Sciences and Humanities.**

License: [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The importer selects and deduplicates publication metadata and author codes, then derives person-pair edges and provisional catalog associations. It does not reproduce editorial reviews or abstracts. Per-record `recordProvenance` retains the supplied data-source notices.

Collect and import zbMATH records with:

```sh
node scripts/discover-zbmath.mjs --catalog
node scripts/import-zbmath.mjs
npm run research
npm run build
```

The importer requires actual `/tmp/grad-tinder-zbmath-candidates.json` and `/tmp/grad-tinder-zbmath-documents.json` checkpoints. It does not generate a production file from fabricated examples. Imported identities remain explicitly indexed and unreviewed. The separate display-grouping layer can combine identities using publication and identity evidence while retaining original records; names alone are insufficient. This grouping also applies to professor matching and exports.

See [the connection-data documentation](../../docs/CONNECTIONS.md) and [the OpenAlex expansion workflow](../../docs/network-expansion.md) for the other research pipelines.
