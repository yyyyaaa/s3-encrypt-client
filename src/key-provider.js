const Materials = require('./materials');

class KeyProvider {
  constructor({
    key,
    materialsDescription = '{}'
  }) {
    this._encryptionMaterials = new Materials({
      key: key,
      description: materialsDescription
    });
  }

  get key() {
    return this._encryptionMaterials.key;
  }

  get encryptionMaterials() {
    return this._encryptionMaterials;
  }
}

module.exports = KeyProvider;