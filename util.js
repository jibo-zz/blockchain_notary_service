const util = {
  empty: obj => {
    if (obj === true) return false;
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) return false;
    }
    return true;
  },

  isASCII: str => {
    return /^[\x00-\x7F]*$/.test(str);
  },

  isStringChainEquals: (a, b) => {
    let mismatch = 0;
    for (let i = 0; i < a.length; ++i) {
      mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return !mismatch;
  }
};

module.exports = util;
