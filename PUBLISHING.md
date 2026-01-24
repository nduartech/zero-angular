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
   cd dist/zero-angular
   npm pack
   # Inspect the .tgz to ensure compiled output + typings are present.
   ```

5. Dry-run publish to validate

   ```bash
   cd dist/zero-angular
   npm publish --dry-run
   ```

6. Publish from CI (recommended)

   - Add `NPM_TOKEN` secret to the GitHub repository.
   - Merge PR to `main` to trigger the GitHub Actions workflow `Release`.
   - On `push` to `main` (or manual `workflow_dispatch`), the workflow will run `changesets/action` which:
     - Creates a "Version Packages" PR when changesets are present, or
     - Publishes to npm when the Version Packages PR is merged.
   - PRs only run verify (test + build); they do not publish.

Notes

- The root workspace is private; the publishable package is `dist/zero-angular` created by ng-packagr.
- Versioning must run before building so the dist `package.json` has the right version.

Safety

- I will not run any real publish command without explicit instruction.
