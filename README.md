# AY Inbox CLI

`ayinbox` is the command line tool for [AY Inbox](https://ayinbox.com), a hosted cold email platform. It signs in as you and works with campaigns, contacts, mailboxes and the inbox through the public REST API at `https://api.ayinbox.com/v1`, from a terminal, a CI job or an AI agent.

AY Inbox is a hosted service. This repository holds the CLI's release binaries, install scripts and packaging. The service itself is not open source, and neither is the CLI's source code.

```bash
ayinbox auth login
ayinbox campaign list
ayinbox inbox list --unseen
ayinbox api "/campaigns?limit=10"
```

Access: invite only for now. Write to team@ayinbox.com.

## Install

Every method installs the same single static binary.

**macOS and Linux**

```bash
curl -fsSL https://github.com/ayinbox/ayinbox-cli/releases/latest/download/cli.sh | sh
```

Installs to `~/.local/bin` with no root and no toolchain. The script checks the archive against the release's `checksums.txt` and installs nothing if they disagree. `sh -s -- --help` lists its flags (install directory, pinned version, mirror, uninstall, dry run).

**Windows** (PowerShell)

```powershell
irm https://github.com/ayinbox/ayinbox-cli/releases/latest/download/cli.ps1 | iex
```

Installs to `%LOCALAPPDATA%\AyInbox\bin` and adds it to your user PATH. No admin rights.

**Homebrew** (macOS and Linux)

```bash
brew install ayinbox/tap/ayinbox
```

**Scoop** (Windows)

```powershell
scoop bucket add ayinbox https://github.com/ayinbox/homebrew-tap
scoop install ayinbox
```

**Docker**

```bash
docker run --rm -e AYINBOX_TOKEN ghcr.io/ayinbox/ayinbox-cli campaign list
```

A container has no browser, so pass an API key in `AYINBOX_TOKEN` instead of running `auth login`.

**npm**

Not on npm yet. When it is, `npm install -g @ayinbox/cli` will download the same release archive and verify it against `checksums.txt`. The wrapper lives in [`npm/`](npm/).

**By hand**

Each [release](https://github.com/ayinbox/ayinbox-cli/releases) carries `ayinbox_<os>_<arch>.tar.gz` (or `.zip` on Windows) for macOS, Linux and Windows on amd64 and arm64, plus `checksums.txt`. Unpack the one for your machine and put `ayinbox` on your PATH.

## Verify before you run

Read the install script and check it against its published checksum before running it:

```bash
curl -fsSLO https://github.com/ayinbox/ayinbox-cli/releases/latest/download/cli.sh
curl -fsSLO https://github.com/ayinbox/ayinbox-cli/releases/latest/download/cli.sh.sha256
sha256sum -c cli.sh.sha256        # on macOS: shasum -a 256 -c cli.sh.sha256
less cli.sh && sh cli.sh
```

`cli.ps1` has a `cli.ps1.sha256` next to it. To check an archive you downloaded yourself:

```bash
curl -fsSLO https://github.com/ayinbox/ayinbox-cli/releases/latest/download/checksums.txt
sha256sum -c --ignore-missing checksums.txt
```

## Sign in

```bash
ayinbox auth login
```

The browser path shows a code, opens `app.ayinbox.com/cli` and waits for you to approve. Approving creates one API key named for your machine, which you can revoke under Settings > API keys or with `ayinbox auth logout`. To start with less than full access:

```bash
ayinbox auth login --scopes read-only
```

In CI, skip the login and set `AYINBOX_TOKEN` to an API key (they start with `aybox_`). It overrides the saved sign-in and is never written to disk.

```bash
ayinbox auth status
```

shows which credential is in use and where it came from.

## A short tour

```bash
ayinbox status                                 # mailboxes needing attention, what is sending, what is unread
ayinbox campaign list --json | jq '.data[].name'
ayinbox campaign preflight CAMPAIGN_ID
ayinbox mailbox list
ayinbox mailbox check MAILBOX_ID               # SPF, DKIM and DMARC for one mailbox
ayinbox inbox list --unseen --limit 20
ayinbox contact list --all --json > contacts.json
ayinbox events tail                            # the live event stream
ayinbox api /me                                # any endpoint, relative to /v1
```

Output is a table on a terminal and JSON when piped, so the same command works for a person and a script. `--all` follows the cursor on any list command.

Commands that put mail on the wire (`campaign start`, `campaign test`, `mailbox send`, `inbox reply`, `inbox compose`, `inbox approve-draft` and the placement test starters) ask before they act and refuse when there is no terminal to ask on. `--yes` is the only way past the prompt. Starting a campaign needs a key with the `SEND_CAMPAIGNS` scope.

Keep it current with:

```bash
ayinbox version
ayinbox upgrade
```

`upgrade` verifies the new archive against the release checksums before replacing the binary. A Homebrew or Scoop install is told which command to run instead. A once-a-day release check prints one line when a newer version exists; `AYINBOX_NO_UPDATE_CHECK=1` turns it off.

## Documentation

- [CLI reference](https://docs.ayinbox.com/api/cli/)
- [Authentication](https://docs.ayinbox.com/api/authentication/) and [permissions](https://docs.ayinbox.com/api/permissions/)
- [API docs](https://docs.ayinbox.com/)

## Licence

The binaries are proprietary and free to use with an AY Inbox account. See [LICENSE](LICENSE). Report security issues as described in [SECURITY.md](SECURITY.md).
