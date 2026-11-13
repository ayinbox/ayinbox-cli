# Publishing @ayinbox/cli

The package is published from `.github/workflows/npm.yml` when a release is published on this repository, with npm trusted publishing (OIDC). No npm token is stored anywhere.

## One-time setup

1. Sign in to npmjs.com with the account that will own the package and create the `ayinbox` organization, so the `@ayinbox` scope exists. Turn on two-factor authentication for the account.
2. The first version has to exist before a trusted publisher can be attached. From a clean checkout, publish a placeholder by hand once:
   ```bash
   cd npm
   npm version 0.0.1 --no-git-tag-version
   npm publish --access public
   git checkout package.json
   ```
   Or skip this if your npm account can configure a trusted publisher for a package that does not exist yet.
3. On npmjs.com, open the package's Settings > Trusted publishing and add a GitHub Actions publisher: owner `ayinbox`, repository `ayinbox-cli`, workflow `npm.yml`, no environment.
4. In the repository's Settings > Secrets and variables > Actions > Variables, set `NPM_PUBLISH` to `true`. Until it is set, the workflow skips publishing.
5. Optionally, under the package's Settings > Publishing access, require two-factor authentication and disallow tokens.

## Every release

Nothing to do by hand. When a maintainer publishes release `vX.Y.Z` (with `scripts/publish-cli.sh` in the source repository), the workflow sets the package version to `X.Y.Z`, runs the tests and publishes with provenance. A prerelease tag publishes under the `next` dist-tag.

`package.json` stays at `0.0.0` in git; that version means "install the latest release" when run from a checkout.
