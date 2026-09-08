# Static workspace database

Ferriq runs entirely on GitHub Pages. No PostgreSQL server, API service, login provider, API key, or external market request is required.

- `public/data/workspace.json` holds the published equipment observations, configurations, settings and economics scenario. The trained model is a separate static JSON file. A content hash identifies the combined published revision.
- IndexedDB (`ferriq-workspace`, schema version 1) holds local resource edits, historical versions and the change log. Each resource has an optimistic version check. BroadcastChannel refreshes other open tabs after changes.
- All visitors receive the published reference data. Browser edits do **not** write to GitHub or synchronize between devices. Export a backup before clearing site data or moving devices. Browser storage is not an access-control boundary; do not publish confidential plant data in a public repository.

## Backup and restore

Open **Database & change log → Export workspace backup**. Restore using **Import workspace backup**, review the validated resource list, then **Apply backup locally**. Imports are applied resource by resource; if one conflicts, previously applied resources remain saved and the error is displayed. Each original resource has its own restore-published action. A backup includes model/history and local configuration but not previous local audit history.

## Publish a reviewed workspace

1. Export a backup from the browser.
2. Run `npm run data:import -- path/to/ferriq-workspace.json` in this repository. This validates the backup and writes `reference/workspace-overrides.json`; it does not push or deploy.
3. Review the data/configuration diff. Run `npm run build`, `npm test`, and `npm run test:e2e`. The build combines defaults with reviewed overrides and regenerates the published JSON.
4. Commit the reviewed source and generated files through the normal repository review process. The existing main-branch GitHub Pages workflow publishes the static build.

Existing browsers retain their local overlays across publication. Export them before restoring published data. Restore the relevant resource to adopt a new published version.

## Local development and quality checks

Use Node 22.18+ (Node 24 recommended), `npm ci`, then `npm run dev`. `npm run test:parity` compares original HTML pure functions against TypeScript using Node's built-in TypeScript stripping. `npm run test:e2e` uses installed Chrome on Windows; elsewhere install Playwright Chromium or set `PLAYWRIGHT_EXECUTABLE_PATH`. GitHub Pages builds use `DEPLOY_BASE_PATH=/Ferriq/`; local builds use `/`.

The older optional PostgreSQL draft was excluded from the application after the static-only requirement. No backend deployment is needed.
