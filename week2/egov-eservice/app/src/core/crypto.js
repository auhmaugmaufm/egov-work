'use strict';
const nodeCrypto = require('crypto');

const DEFAULT_PII = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const piiKey = () => {
  const hex = process.env.PII_KEY || DEFAULT_PII;
  const b = Buffer.from(hex, 'hex');
  return b.length === 32 ? b : nodeCrypto.createHash('sha256').update(hex).digest();
};
const docKey = () => process.env.DOC_KEY || 'egov-test-doc-signing-key';

function encrypt(plain) {
  if (plain === null || plain === undefined) return null;
  const iv = nodeCrypto.randomBytes(12);
  const c = nodeCrypto.createCipheriv('aes-256-gcm', piiKey(), iv);
  const ct = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

function decrypt(enc) {
  if (enc === null || enc === undefined) return null;
  const [v, iv, tag, ct] = String(enc).split(':');
  if (v !== 'v1') throw new Error('bad ciphertext');
  const d = nodeCrypto.createDecipheriv('aes-256-gcm', piiKey(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
}

const hashId = (idNo) => nodeCrypto.createHmac('sha256', piiKey()).update('id:' + idNo).digest('hex');

function hashPassword(pw) {
  const salt = nodeCrypto.randomBytes(8).toString('hex');
  return 'sha256$' + salt + '$' + nodeCrypto.createHash('sha256').update(salt + pw).digest('hex');
}

function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'sha256') return false;
  const a = Buffer.from(nodeCrypto.createHash('sha256').update(parts[1] + String(pw)).digest('hex'));
  const b = Buffer.from(parts[2]);
  return a.length === b.length && nodeCrypto.timingSafeEqual(a, b);
}

const hmacDoc = (fields) => nodeCrypto.createHmac('sha256', docKey()).update(fields.join('|')).digest('hex');

function randomFrom(alphabet, n) {
  let s = '';
  const bytes = nodeCrypto.randomBytes(n);
  for (let i = 0; i < n; i++) s += alphabet[bytes[i] % alphabet.length];
  return s;
}
const randomLetters = (n) => randomFrom('abcdefghijklmnopqrstuvwxyz', n);
const randomCode8 = () => randomFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

module.exports = { encrypt, decrypt, hashId, hashPassword, verifyPassword, hmacDoc, randomLetters, randomCode8 };
