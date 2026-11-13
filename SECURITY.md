# Security

Please report a vulnerability in the `ayinbox` CLI, its install scripts or its packaging by email to team@ayinbox.com. Do not open a public issue for it.

Include what you found, how to reproduce it and which version (`ayinbox version`) you used. We will confirm receipt and keep you informed while we fix it.

Every release archive is listed in the release's `checksums.txt`, and `cli.sh` and `cli.ps1` each have a `.sha256` file next to them. The install scripts, `ayinbox upgrade` and the npm wrapper refuse to install an archive whose checksum does not match.
