const crypto = require('crypto');
const zlib = require('zlib');
const pipe = require('multipipe');
const utils = require('./utils');

const BLOCK_MODE = 'CBC';

class CipherProvider {
  constructor(keyProvider) {
    this._keyProvider = keyProvider;
  }

  get keyProvider() {
    return this._keyProvider;
  }

  // Flow:
  // Step 1: create cipher from a random, 1-time use local key, the cipher will be used to encrypt the data, this key will be used
  //   in step 2
  // Step 2: enveloping process:
  // - use the application master key to encrypt the local key from step 1
  // - place the encrypted local key in metadata payload
  // - the cipher from step 1 is used to encrypt the actual uploading file
  encryptionCipher() {
    const { key, iv, cipher, cipherStream } = this.createCipher();
    const envelop = {
      'x-amz-key': utils.encodeBase64(this.encrypt(key)),
      'x-amz-iv': utils.encodeBase64(iv),
      'x-amz-matdesc': this._keyProvider.encryptionMaterials.description,
    };
    return { envelop, cipher, cipherStream };
  }

  /**
   * Given a metadata envelop, return its decryption cipher
   * @param {*} envelop The Metadata field in s3 getObject response
   */
  decryptionCipher(envelop) {
    const masterKey = this._keyProvider.key;
    const key = utils.decrypt(
      masterKey,
      utils.decodeBase64(envelop['x-amz-key'])
    );
    const iv = utils.decodeBase64(envelop['x-amz-iv']);

    const decipher = utils.aesDecryptCipher(BLOCK_MODE, key, iv);
    return {
      decipher,
      decipherStream: this.createDecipherStream(decipher),
    };
  }

  createCipher() {
    const localKey = crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = utils.aesEncryptCipher(BLOCK_MODE, localKey, iv);

    return {
      iv,
      key: localKey,
      cipher,
      cipherStream: this.createCipherStream(cipher),
    };
  }

  createCipherStream(cipher) {
    const gzip = zlib.createGzip();
    return pipe(gzip, cipher);
  }

  createDecipherStream(decipher) {
    const unzip = zlib.createGunzip();
    return pipe(decipher, unzip);
  }

  /**
   * Encrypt the local key with the application's master key
   * @param {*} data the local key
   */
  encrypt(data) {
    const masterKey = this._keyProvider.encryptionMaterials.key;
    return utils.encrypt(masterKey, Buffer.from(data));
  }
}

module.exports = CipherProvider;
