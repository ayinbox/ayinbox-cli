'use strict';

const { install } = require('../lib/install');

install({ log: (m) => process.stderr.write(`@ayinbox/cli: ${m}\n`) }).catch((err) => {
  // A failed verification stops the install; a network failure is retried on first run.
  if (err.code === 'ECHECKSUM' || err.code === 'EARCHIVE' || err.code === 'EPLATFORM') {
    process.stderr.write(`@ayinbox/cli: ${err.message}\n`);
    process.exit(1);
  }
  process.stderr.write(`@ayinbox/cli: ${err.message}\n@ayinbox/cli: the binary will be downloaded on first run instead.\n`);
});
