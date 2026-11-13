#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { binaryPath, install } = require('../lib/install');

async function main() {
  let bin = binaryPath();
  // Installed with --ignore-scripts, or postinstall could not reach GitHub: fetch now.
  if (!fs.existsSync(bin)) {
    bin = await install({ log: (m) => process.stderr.write(`ayinbox: ${m}\n`) });
  }
  const result = spawnSync(bin, process.argv.slice(2), { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.signal) process.kill(process.pid, result.signal);
  process.exit(result.status === null ? 1 : result.status);
}

main().catch((err) => {
  process.stderr.write(`ayinbox: ${err.message}\n`);
  process.exit(1);
});
