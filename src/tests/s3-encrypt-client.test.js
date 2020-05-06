const aws = require('aws-sdk');
const { Readable } = require('stream');
const S3EncryptionClient = require('../');
const utils = require('../utils');

describe('S3EncryptionClient', () => {
  let client, encryptionClient, masterKey;

  beforeAll(() => {
    client = new aws.S3({
      region: 'us-west-2',
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      s3ForcePathStyle: true,
      maxRetries: 0, // disable retries
    });

    masterKey = utils.decodeBase64(
      'kM5UVbhE/4rtMZJfsadYEdm2vaKFsmV2f5+URSeUCV4='
    );

    encryptionClient = new S3EncryptionClient({
      client,
      encryptionKey: masterKey,
    });
  });

  describe('configuration', () => {
    it('constructs a default s3 client when one is not given', () => {
      const encryptionS3 = new S3EncryptionClient({
        encryptionKey: masterKey,
      });
      expect(encryptionS3._client).toBeInstanceOf(aws.S3);
    });

    it('accepts vanilla client options', () => {
      const opts = {
        region: 'us-west-2',
        credentials: new aws.Credentials({
          accessKeyId: 'akid',
          secretAccessKey: 'secret',
        }),
        encryptionKey: masterKey,
      };
      const encryptionS3 = new S3EncryptionClient(opts);
      expect(encryptionS3._client.config.credentials.accessKeyId).toBe('akid');
      expect(encryptionS3._client.config.credentials.secretAccessKey).toBe(
        'secret'
      );
    });

    it('requires an encryption key', () => {
      const tryIt = () => {
        const encryptionS3 = new S3EncryptionClient();
        return encryptionS3;
      };
      expect(tryIt).toThrow();
    });

    it('constructs a key provider from a master key', () => {
      expect(encryptionClient._keyProvider.key).toBe(masterKey);
    });
  });

  describe('encryption methods', () => {
    describe('#upload', () => {
      let S3 = aws.S3;
      beforeEach(() => {
        aws.S3 = jest.fn().mockImplementation(() => {
          return {
            upload(params) {
              return {
                promise: () => Promise.resolve(params),
              };
            },
          };
        });
      });

      afterEach(() => {
        // restore
        aws.S3 = S3;
      });

      it('encrypts data client-side', async () => {
        const stream = mockReadStream();

        const encryptionS3 = new S3EncryptionClient({
          encryptionKey: masterKey,
        });

        const result = await encryptionS3.upload({
          Stream: stream,
          Bucket: 'my-bucket',
          Key: 'my-key',
        });
        expect(result.Metadata['x-amz-iv']).toBeTruthy();
        expect(result.Metadata['x-amz-key']).toBeTruthy();
      });
    });
  });

  describe('#getSignedUrl', () => {
    const originalS3 = aws.S3;

    afterEach(() => {
      // restore
      aws.S3 = originalS3;
    });

    it('throws error if Key is absent', async () => {
      const encryptionS3 = new S3EncryptionClient({
        encryptionKey: masterKey,
      });

      await expect(encryptionS3.getSignedUrl()).rejects.toThrow();
    });

    it('returns pre-signed URL for existing file', async () => {
      const mockHeadResponse = {
        AcceptRanges: 'bytes',
        LastModified: '2019-12-05T09:25:26.000Z',
        ContentLength: 7295840,
        ETag: '"b1d7951871cdda178734d4d824a503fb-2"',
        VersionId: 'EeIwjmtCqZXw6SJ9q2WmTbXk7n4Cb_9h',
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
        Metadata: {
          'x-amz-key':
            'mRE+paiIwCzbnCu2qr5wqtYUgw3h1nilIA7sjBOX4wXgPuiamZ0F5wJPvgTjDbB0',
          'x-amz-matdesc': '{}',
          'x-amz-iv': 'mdlSjJRRjE1zLneja8TUSg==',
        },
      };
      const mockSignedUrl = 'https://mock-url';

      aws.S3 = jest.fn().mockImplementation(() => {
        return {
          getSignedUrlPromise() {
            return Promise.resolve(mockSignedUrl);
          },
          headObject() {
            return {
              promise: () => Promise.resolve(mockHeadResponse),
            };
          },
        };
      });

      const encryptionS3 = new S3EncryptionClient({
        encryptionKey: masterKey,
      });

      const result = await encryptionS3.getSignedUrl({
        Key: 'my-key',
        EncryptedBucket: 'encrypt-bucket',
        DecryptedBucket: 'decrypt-bucket',
      });
      expect(result).toBe(mockSignedUrl);
    });

    it('executes encrypt and upload sequence then return pre-signed URL for non-existing file', async () => {
      const mockSignedUrl = 'https://mock-url';

      aws.S3 = jest.fn().mockImplementation(() => {
        return {
          headObject() {
            return {
              promise: () =>
                Promise.reject({
                  code: 'NotFound',
                }),
            };
          },
        };
      });

      const encryptionS3 = new S3EncryptionClient({
        encryptionKey: masterKey,
      });

      const spy = jest
        .spyOn(encryptionS3, 'getDecryptedSignedUrl')
        .mockImplementation(() => {
          return Promise.resolve(mockSignedUrl);
        });

      const result = await encryptionS3.getSignedUrl({
        Key: 'my-key',
        EncryptedBucket: 'encrypt-bucket',
        DecryptedBucket: 'decrypt-bucket',
      });

      expect(result).toBe(mockSignedUrl);
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
    });
  });
});

function mockReadStream() {
  const stream = new Readable();
  stream._read = () => {};
  stream.push('my file message');
  stream.push(null);
  return stream;
}
