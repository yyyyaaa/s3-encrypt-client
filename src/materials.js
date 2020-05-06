class Materials {
  constructor({
    key,
    description
  }) {
    this._key = this.validateKey(key);
    this._description = this.validateDesc(description);
  }

  get key() {
    return this._key;
  }

  get description() {
    return this._description;
  }

  /**
   * Validate if an encryption key is a valid symmetric key
   * @param {string} key The encryption key
   */
  validateKey(key) {
    const length = Buffer.byteLength(key, 'utf8');
    if ([32, 24, 16].includes(length)) return key;
    throw new Error(
      `invalid key, symmetric key expect to have 16, 24, 32 bytes in length, saw length: ${length}`
    );
  }

  /**
   * Validate a material description string
   * @param {JSON string} description
   */
  validateDesc(description) {
    try {
      JSON.parse(description);
      return description;
    } catch (err) {
      throw new Error('expect description to be a valid JSON string');
    }
  }
}

module.exports = Materials;