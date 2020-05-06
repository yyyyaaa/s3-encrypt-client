const aws = require('aws-sdk');
const {
  PassThrough,
  pipeline: _pipeline
} = require('stream');
const {
  promisify
} = require('util');

const KeyProvider = require('./key-provider');
const CipherProvider = require('./cipher-provider');
const pipeline = promisify(_pipeline);

class S3EncryptionClient {
  constructor({
    client,
    encryptionKey,
    ...options
  }) {
    this._client = client || this.extractClient(options);
    this._cipherProvider = this.extractCipherProvider(encryptionKey);
  }

  extractClient(options) {
    const {
      endpointUrl,
      ...otherOpts
    } = options;
    const endpoint = endpointUrl ? new aws.Endpoint(endpointUrl) : null;

    return new aws.S3({
      endpoint: endpoint,
      ...otherOpts
    });
  }

  extractCipherProvider(encryptionKey) {
    this._keyProvider = this.extractKeyProvider(encryptionKey);
    return new CipherProvider(this._keyProvider);
  }

  extractKeyProvider(encryptionKey) {
    if (!encryptionKey) {
      throw new Error('you must pass an encryptionKey');
    }
    return new KeyProvider({
      key: encryptionKey
    });
  }

  upload(options) {
    const {
      Stream: inStream,
      ...otherOpts
    } = options;
    const {
      envelop,
      cipherStream
    } = this._cipherProvider.encryptionCipher();
    const outStream = new PassThrough();

    const params = {
      ...otherOpts,
      Body: outStream,
      Metadata: envelop
    };
    const uploadPromise = this._client.upload(params).promise();
    pipeline(inStream, cipherStream, outStream);
    return uploadPromise;
  }

  getObject(options) {
    const {
      Stream: outStream,
      ...otherOpts
    } = options;
    const headRequest = this._client.headObject(otherOpts);
    const getRequest = this._client.getObject(otherOpts);

    return new Promise((resolve, reject) => {
      headRequest
        .promise()
        .then(result => {
          const envelop = result.Metadata;
          const {
            decipherStream
          } = this._cipherProvider.decryptionCipher(
            envelop
          );
          return decipherStream;
        })
        .then(decipherStream =>
          pipeline(getRequest.createReadStream(), decipherStream, outStream)
        )
        .then(resolve)
        .catch(reject);
    });
  }

  /**
   * Generate signed Url for an encrypted file
   * @param {*} options
   * Key: encrypted file key. ie. local/image.png
   * Other options are identical to S3 sdk getSignedUrl
   */
  async getSignedUrl(options = {}) {
    const {
      Key,
      EncryptedBucket,
      DecryptedBucket,
      ...otherOpts
    } = options;

    if (!Key) {
      throw new Error('Key is required');
    }

    if (!EncryptedBucket || !DecryptedBucket) {
      throw new Error('EncryptedBucket and DecryptedBucket are required');
    }

    try {
      const metadata = await this._client
        .headObject({
          Bucket: DecryptedBucket,
          Key: Key
        })
        .promise();
      // Decrypted file exists, proceed to generate signed url
      if (metadata) {
        return this._client.getSignedUrlPromise('getObject', {
          Key: Key,
          Bucket: DecryptedBucket,
          ...otherOpts
        });
      }
    } catch (err) {
      if (err.code === 'NotFound') {
        return this.getDecryptedSignedUrl({
          Key,
          EncryptedBucket,
          DecryptedBucket,
          ...otherOpts
        });
      } else {
        throw err;
      }
    }
  }

  /**
   * Get decrypted signed url
   * @param {*} Key
   */
  async getDecryptedSignedUrl(options = {}) {
    const {
      Key,
      EncryptedBucket,
      DecryptedBucket,
      ...otherOpts
    } = options;
    const outStream = new PassThrough();
    const uploadDecrypted = this._client
      .upload({
        ACL: 'private',
        Bucket: DecryptedBucket,
        Key: Key,
        Body: outStream
      })
      .promise();

    const getEncryptedFile = this.getObject({
      Key: Key,
      Bucket: EncryptedBucket,
      Stream: outStream
    });

    await Promise.all([getEncryptedFile, uploadDecrypted]);

    return this._client.getSignedUrlPromise('getObject', {
      Key: Key,
      Bucket: DecryptedBucket,
      ...otherOpts
    });
  }
}

module.exports = S3EncryptionClient;