'use strict';

// Downloads the ayinbox release archive for this platform, verifies it against
// the release's checksums.txt and unpacks the binary. No dependencies.

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const zlib = require('node:zlib');

const REPO = 'ayinbox/ayinbox-cli';
const MAX_BYTES = 200 * 1024 * 1024;
const VENDOR_DIR = path.join(__dirname, '..', 'vendor');

class InstallError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function target(platform = process.platform, arch = process.arch) {
  const os = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[platform];
  const cpu = { x64: 'amd64', arm64: 'arm64' }[arch];
  if (!os || !cpu) {
    throw new InstallError(`no ayinbox build for ${platform}/${arch}; builds exist for macOS, Linux and Windows on x64 and arm64`, 'EPLATFORM');
  }
  const asset = os === 'windows' ? `ayinbox_${os}_${cpu}.zip` : `ayinbox_${os}_${cpu}.tar.gz`;
  const binary = os === 'windows' ? 'ayinbox.exe' : 'ayinbox';
  return { os, cpu, asset, binary };
}

// The package version names the release it installs; 0.0.0 is an unreleased checkout.
function releaseVersion(env = process.env) {
  if (env.AYINBOX_CLI_VERSION) return env.AYINBOX_CLI_VERSION;
  const pkg = require('../package.json');
  return pkg.version === '0.0.0' ? 'latest' : `v${pkg.version}`;
}

function baseURL(version, env = process.env) {
  if (env.AYINBOX_CLI_BASE_URL) return env.AYINBOX_CLI_BASE_URL.replace(/\/+$/, '');
  if (version === 'latest') return `https://github.com/${REPO}/releases/latest/download`;
  return `https://github.com/${REPO}/releases/download/${version}`;
}

function fetchBuffer(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : u.protocol === 'http:' ? http : null;
    if (!client) return reject(new InstallError(`unsupported URL ${url}`, 'EURL'));
    const req = client.get(u, { headers: { 'User-Agent': 'ayinbox-npm' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects === 0) return reject(new InstallError(`too many redirects for ${url}`, 'EDOWNLOAD'));
        const next = new URL(res.headers.location, u);
        if (u.protocol === 'https:' && next.protocol !== 'https:') {
          return reject(new InstallError(`refusing a redirect from https to ${next.protocol}`, 'EDOWNLOAD'));
        }
        return resolve(fetchBuffer(next.toString(), redirects - 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new InstallError(`could not download ${url}: HTTP ${res.statusCode}`, 'EDOWNLOAD'));
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BYTES) {
          req.destroy();
          reject(new InstallError(`${url} is larger than expected`, 'EDOWNLOAD'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.setTimeout(120000, () => req.destroy(new InstallError(`timed out downloading ${url}`, 'EDOWNLOAD')));
    req.on('error', (err) => reject(err instanceof InstallError ? err : new InstallError(`could not download ${url}: ${err.message}`, 'EDOWNLOAD')));
  });
}

function parseChecksums(text) {
  const sums = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([0-9a-fA-F]{64})\s+\*?(\S+)$/.exec(line.trim());
    if (m) sums.set(m[2], m[1].toLowerCase());
  }
  return sums;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function verify(archive, asset, checksumsText) {
  const want = parseChecksums(checksumsText).get(asset);
  if (!want) throw new InstallError(`checksums.txt has no entry for ${asset}; nothing was installed`, 'ECHECKSUM');
  const got = sha256(archive);
  if (got !== want) {
    throw new InstallError(`checksum mismatch for ${asset}\n  expected ${want}\n  got      ${got}\nNothing was installed.`, 'ECHECKSUM');
  }
}

function tarString(block, start, length) {
  const raw = block.subarray(start, start + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString('utf8');
}

function extractFromTarGz(archive, name) {
  const tar = zlib.gunzipSync(archive);
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const prefix = tarString(header, 345, 155);
    const entry = (prefix ? `${prefix}/` : '') + tarString(header, 0, 100);
    const size = parseInt(tarString(header, 124, 12).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48);
    const start = offset + 512;
    if ((type === '0' || type === '\0') && path.posix.basename(entry) === name) {
      return Buffer.from(tar.subarray(start, start + size));
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new InstallError(`the archive did not contain ${name}`, 'EARCHIVE');
}

function extractFromZip(archive, name) {
  let eocd = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--) {
    if (archive.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd === -1) throw new InstallError('the archive is not a zip file', 'EARCHIVE');
  const entries = archive.readUInt16LE(eocd + 10);
  let p = archive.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (archive.readUInt32LE(p) !== 0x02014b50) break;
    const method = archive.readUInt16LE(p + 10);
    const compSize = archive.readUInt32LE(p + 20);
    const nameLen = archive.readUInt16LE(p + 28);
    const extraLen = archive.readUInt16LE(p + 30);
    const commentLen = archive.readUInt16LE(p + 32);
    const local = archive.readUInt32LE(p + 42);
    const entry = archive.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    if (path.posix.basename(entry) === name) {
      if (archive.readUInt32LE(local) !== 0x04034b50) throw new InstallError('the zip file is damaged', 'EARCHIVE');
      const dataStart = local + 30 + archive.readUInt16LE(local + 26) + archive.readUInt16LE(local + 28);
      const data = archive.subarray(dataStart, dataStart + compSize);
      if (method === 0) return Buffer.from(data);
      if (method === 8) return zlib.inflateRawSync(data);
      throw new InstallError(`unsupported zip compression method ${method}`, 'EARCHIVE');
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new InstallError(`the archive did not contain ${name}`, 'EARCHIVE');
}

function binaryPath(dir = VENDOR_DIR) {
  return path.join(dir, target().binary);
}

async function install({ dir = VENDOR_DIR, env = process.env, log = () => {} } = {}) {
  const t = target();
  const version = releaseVersion(env);
  const base = baseURL(version, env);
  log(`downloading ayinbox ${version} (${t.os}/${t.cpu})`);
  const archive = await fetchBuffer(`${base}/${t.asset}`);
  const sums = await fetchBuffer(`${base}/checksums.txt`);
  verify(archive, t.asset, sums.toString('utf8'));
  const binary = t.os === 'windows' ? extractFromZip(archive, t.binary) : extractFromTarGz(archive, t.binary);

  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, t.binary);
  const tmp = `${dest}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, binary, { mode: 0o755 });
  fs.renameSync(tmp, dest);
  log(`installed ${dest}`);
  return dest;
}

module.exports = {
  InstallError,
  REPO,
  target,
  releaseVersion,
  baseURL,
  parseChecksums,
  verify,
  extractFromTarGz,
  extractFromZip,
  binaryPath,
  install,
};
