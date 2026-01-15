# Publishing Guide

This document explains how to prepare and publish `@nathanld/zero-angular`.

Local quick steps

1. Install dependencies

   ```bash
   bun install
   # or
   npm install
   ```

2. Create a changeset describing your change

   ```bash
   npx @changesets/cli
   # or
   bunx changeset
   ```

3. Apply versions (this will update package.json files and CHANGELOG)

   ```bash
   npx @changesets/cli version
   # or
   bunx changeset version
   ```

4. Build the library and verify package contents

   ```bash
   bunx ng build zero-angular --configuration=production
   npm pack
   # Inspect the .tgz to ensure dist/ and README.md are present and no large caches or node_modules are included
   ```

5. Dry-run publish to validate

   ```bash
   bunx changeset publish --dry-run
   # or
   npx @changesets/cli publish --dry-run
   ```

6. Publish from CI (recommended)

   - Add `NPM_TOKEN` secret to the GitHub repository.
   - Merge PR to `main` to trigger the GitHub Actions workflow `Release` (the workflow runs a dry-run by default).
   - When you're ready to actually publish, update the workflow to remove `--dry-run` or run `bunx changeset publish` on CI with `NODE_AUTH_TOKEN`/`NPM_TOKEN` configured.

Notes

- The root workspace is private; the library package is produced into `dist/zero-angular` by `ng-packagr` and has its own `package.json` inside `dist/zero-angular` created during build.
- Ensure `dist/` is built and included in the package before publishing.
- The workflow `release.yml` added to `.github/workflows` runs `changeset version` and `changeset publish --dry-run` using Bun.

Safety

- I will not run any real publish command without explicit instruction.
