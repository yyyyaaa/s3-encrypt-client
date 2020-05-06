# s3-encrypt-client

s3-encrypt-client is a Node.js wrapper around AWS SDK for dealing with [client-side encryption](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingClientSideEncryption.html).
For some reasons the Javascript SDK does not implement this feature, this small library does that.

## Installation

Must have peer dependency: `aws-sdk`

## Usage

```javascript
const aws = require('aws-sdk');
const S3EncryptClient = require('s3-encrypt-client');

// This is required for client-side encryption
const encryptionKey = crypto
  .createHash('sha256')
  .update(process.env.ENCRYPTION_KEY)
  .digest();

const client = new aws.S3({
  region: 'us-west-2',
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  s3ForcePathStyle: true,
});

// You can either pass in your S3 client instance or if left blank
// a new s3 instance is created internally inside S3EncryptClient
const encryptionClient = new S3EncryptClient({
  client,
  encryptionKey,
});

// Do something with it
const s3Response = await s3Encryption.upload({
  Stream: stream,
  ACL: 'private',
  Bucket: env.BUCKET_PRIVATE,
  Key: filename,
});
```

## Supported methods

All of the following methods have identical options params to the AWS SDK S3 client, with a few additional params for encryption flow.

- `upload(options)`

  Lets you upload a file to a bucket, the uploaded file is encrypted using client-side encryption.

  `options.Stream`(required): this can be either Node.js's `ReadableStream` or `DuplexStream`

- `getObject(options)`

  Lets you get an encrypted object from a bucket and decrypt it.

  `options.Stream`(required): this should be Node.js's `WriteableStream` or `PassThroughStream`

- `getSignedUrl(options)`

  Lets you getSignedUrl of an encrypted file. Note that to support this method properly, a S3 config for `DecryptedBucket` to auto-delete files within an expiration period must be added.

  Or else you end up with multiple copies of the decrypted objects for the same encrypted object for an unwanted extended period of time, which defeats the purpose of decrypting files in the first place.

  `options.EncryptedBucket`(required): the encrypted file bucket

  `options.DecryptedBucket`(required): the decrypted file bucket

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
