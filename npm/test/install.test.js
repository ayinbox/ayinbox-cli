'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const zlib = require('node:zlib');

const lib = require('../lib/install');

function tarEntry(name, body) {
  const header = Buffer.alloc(512);
  header.write(name, 0);
  header.write('0000755\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  header.write(body.length.toString(8).padStart(11, '0') + '\0', 124);
  header.write('00000000000\0', 136);
  header.write('        ', 148);
  header.write('0', 156);
  header.write('ustar\0', 257);
  header.write('00', 263);
  let sum = 0;
  for (const b of header) sum += b;
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148);
  const pad = Buffer.alloc((512 - (body.length % 512)) % 512);
  return Buffer.concat([header, body, pad]);
}

function tarGz(files) {
  const parts = Object.entries(files).map(([n, b]) => tarEntry(n, Buffer.from(b)));
  return zlib.gzipSync(Buffer.concat([...parts, Buffer.alloc(1024)]));
}

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const comp = zlib.deflateRawSync(data);
    const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, comp);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');

test('maps platforms to the published assets', () => {
  assert.equal(lib.target('darwin', 'arm64').asset, 'ayinbox_darwin_arm64.tar.gz');
  assert.equal(lib.target('linux', 'x64').asset, 'ayinbox_linux_amd64.tar.gz');
  assert.equal(lib.target('win32', 'x64').asset, 'ayinbox_windows_amd64.zip');
  assert.equal(lib.target('win32', 'arm64').binary, 'ayinbox.exe');
  assert.throws(() => lib.target('freebsd', 'x64'), { code: 'EPLATFORM' });
  assert.throws(() => lib.target('linux', 'ia32'), { code: 'EPLATFORM' });
});

test('points at the public release repo', () => {
  assert.equal(lib.baseURL('latest', {}), 'https://github.com/ayinbox/ayinbox-cli/releases/latest/download');
  assert.equal(lib.baseURL('v1.2.3', {}), 'https://github.com/ayinbox/ayinbox-cli/releases/download/v1.2.3');
  assert.equal(lib.baseURL('v1.2.3', { AYINBOX_CLI_BASE_URL: 'https://mirror.example/x/' }), 'https://mirror.example/x');
  assert.equal(lib.releaseVersion({ AYINBOX_CLI_VERSION: 'v9.9.9' }), 'v9.9.9');
});

test('parses checksums.txt in both sha256sum formats', () => {
  const a = 'a'.repeat(64);
  const b = 'B'.repeat(64);
  const sums = lib.parseChecksums(`${a}  ayinbox_linux_amd64.tar.gz\n${b} *ayinbox_windows_amd64.zip\nnoise\n`);
  assert.equal(sums.get('ayinbox_linux_amd64.tar.gz'), a);
  assert.equal(sums.get('ayinbox_windows_amd64.zip'), 'b'.repeat(64));
});

test('refuses a mismatched or missing checksum', () => {
  const archive = Buffer.from('archive');
  assert.throws(() => lib.verify(archive, 'x.tar.gz', `${'0'.repeat(64)}  x.tar.gz`), { code: 'ECHECKSUM' });
  assert.throws(() => lib.verify(archive, 'x.tar.gz', `${sha(archive)}  other.tar.gz`), { code: 'ECHECKSUM' });
  assert.doesNotThrow(() => lib.verify(archive, 'x.tar.gz', `${sha(archive)}  x.tar.gz`));
});

test('extracts the binary from a tar.gz and a zip', () => {
  const tgz = tarGz({ './LICENSE': 'licence', './ayinbox': 'unix-binary' });
  assert.equal(lib.extractFromTarGz(tgz, 'ayinbox').toString(), 'unix-binary');
  assert.throws(() => lib.extractFromTarGz(tarGz({ './README.md': 'x' }), 'ayinbox'), { code: 'EARCHIVE' });
  const z = zip({ 'LICENSE': 'licence', 'ayinbox.exe': 'windows-binary' });
  assert.equal(lib.extractFromZip(z, 'ayinbox.exe').toString(), 'windows-binary');
});

async function serve(files) {
  const server = http.createServer((req, res) => {
    const body = files[path.posix.basename(req.url)];
    if (!body) { res.statusCode = 404; return res.end(); }
    res.end(body);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('installs from a mirror and refuses a tampered archive', async (t) => {
  const tg = lib.target();
  const binary = 'binary-for-this-platform';
  const archive = tg.os === 'windows' ? zip({ [tg.binary]: binary }) : tarGz({ [`./${tg.binary}`]: binary });

  const good = await serve({ [tg.asset]: archive, 'checksums.txt': `${sha(archive)}  ${tg.asset}\n` });
  const bad = await serve({ [tg.asset]: archive, 'checksums.txt': `${'0'.repeat(64)}  ${tg.asset}\n` });
  t.after(() => { good.server.close(); bad.server.close(); });

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ayinbox-npm-'));
  const dest = await lib.install({ dir, env: { AYINBOX_CLI_BASE_URL: good.url, AYINBOX_CLI_VERSION: 'v0.0.1' } });
  assert.equal(fs.readFileSync(dest, 'utf8'), binary);

  const badDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ayinbox-npm-bad-'));
  await assert.rejects(lib.install({ dir: badDir, env: { AYINBOX_CLI_BASE_URL: bad.url, AYINBOX_CLI_VERSION: 'v0.0.1' } }), { code: 'ECHECKSUM' });
  assert.deepEqual(fs.readdirSync(badDir), []);
});
