# Publishing

This repository holds release assets, not source. A release is made by a maintainer from the private source repository:

```bash
VERSION=vX.Y.Z ./scripts/build-cli.sh dist
./scripts/publish-cli.sh --tap-dir ../homebrew-tap --dry-run
./scripts/publish-cli.sh --tap-dir ../homebrew-tap --push
```

`publish-cli.sh` creates release `vX.Y.Z` here with the six archives, `checksums.txt`, `cli.sh`, `cli.ps1` and their `.sha256` files, and commits the Homebrew formula and Scoop manifest into `ayinbox/homebrew-tap`. It uses whatever credential `gh` has in the environment.

Publishing the release then triggers, in this repository:

- `image.yml`: builds `ghcr.io/ayinbox/ayinbox-cli:vX.Y.Z` (and `:latest` for a non-prerelease) from the released Linux archives, pinned to their checksums, with this repository's `GITHUB_TOKEN`.
- `npm.yml`: publishes `@ayinbox/cli@X.Y.Z` when the `NPM_PUBLISH` variable is `true`. Setup is in [npm/PUBLISH.md](npm/PUBLISH.md).

## One-time setup

- After the first image push, open the `ayinbox-cli` package under the `ayinbox` organization's Packages, set its visibility to Public, and link it to this repository. GHCR creates packages private, and a private image cannot be pulled without signing in.
- Make sure Settings > Actions > General > Workflow permissions allows the workflows to request `packages: write` (the workflows ask for it explicitly).

`image.yml` can also be run by hand from the Actions tab with a release tag, to rebuild an image.
