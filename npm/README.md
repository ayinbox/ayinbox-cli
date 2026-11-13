# @ayinbox/cli

Installs `ayinbox`, the command line tool for [AY Inbox](https://ayinbox.com), a hosted cold email platform.

AY Inbox is a hosted service. This package holds a small installer for the CLI's release binary. The service itself is not open source, and neither is the CLI.

```bash
npm install -g @ayinbox/cli
ayinbox auth login
```

On install it downloads the release archive for your platform from [github.com/ayinbox/ayinbox-cli](https://github.com/ayinbox/ayinbox-cli/releases), checks it against the release's `checksums.txt` and refuses to install if they disagree. It has no dependencies. If the install ran with `--ignore-scripts`, or GitHub could not be reached, the binary is downloaded and verified the first time you run `ayinbox`.

The package version names the release it installs: `@ayinbox/cli@1.2.3` installs `v1.2.3`.

| Variable | What it does |
|---|---|
| `AYINBOX_CLI_VERSION` | Install another release tag instead, for example `v1.2.3` |
| `AYINBOX_CLI_BASE_URL` | Download the archives and `checksums.txt` from a mirror of the release assets |

macOS, Linux and Windows on x64 and arm64. Node.js 18 or newer.

To upgrade, run `npm install -g @ayinbox/cli@latest` (`ayinbox upgrade` says the same when it sees an npm install).

Documentation: https://docs.ayinbox.com/api/cli/

The binary is proprietary and free to use with an AY Inbox account; see LICENSE.
