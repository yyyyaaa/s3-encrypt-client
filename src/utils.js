const crypto = require('crypto');

function encrypt(key, data) {
  const cipher = aesEncryptCipher('ECB', key);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function decrypt(key, data) {
  const decipher = aesDecryptCipher('ECB', key);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

function aesEncryptCipher(blockMode, key, iv) {
  let create = iv ? crypto.createCipheriv : crypto.createCipher;
  return create(`aes-256-${blockMode.toLowerCase()}`, Buffer.from(key), iv);
}

function aesDecryptCipher(blockMode, key, iv) {
  let create = iv ? crypto.createDecipheriv : crypto.createDecipher;
  return create(`aes-256-${blockMode.toLowerCase()}`, Buffer.from(key), iv);
}

function encodeBase64(str) {
  if (Buffer.isBuffer(str)) return str.toString('base64');
  return Buffer.from(str).toString('base64');
}

function decodeBase64(str) {
  return Buffer.from(str, 'base64');
}

module.exports = {
  encrypt,
  decrypt,
  aesEncryptCipher,
  aesDecryptCipher,
  encodeBase64,
  decodeBase64
};