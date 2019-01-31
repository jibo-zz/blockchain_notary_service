/* ===== Import ==============================    			   |
|  bitcoinjs-message           |
|  ===============================================*/
const db = require('level')('./data/star');
const bitcoinMessage = require('bitcoinjs-message');

const defaultWindow = 300;

getCurrentTimeStamp = () => {
  return new Date().getTime();
};

generateMessage = address => {
  return `${address}:${getCurrentTimeStamp()}:starRegistry`;
};

isExpired = requestTimeStamp => {
  return requestTimeStamp < Date.now() - 5 * 60 * 1000;
};

/* ===== Validation ==========================
|  Util file to manage validation/signature 		|
|  ================================================*/
const validatPool = {
  async isValidSignature(address) {
    return db
      .get(address)
      .then(value => {
        value = JSON.parse(value);
        return value.messageSignature === 'valid';
      })
      .catch(() => {
        throw new Error('Not authorized');
      });
  },

  invalidateSignature(address) {
    db.del(address);
  },

  saveRequestStarValidation: address => {
    const message = generateMessage(address);

    const data = {
      address: address,
      message: message,
      requestTimeStamp: getCurrentTimeStamp(),
      validationWindow: defaultWindow
    };

    db.put(data.address, JSON.stringify(data));

    return data;
  },

  async getPendingAddress(address) {
    return new Promise((resolve, reject) => {
      db.get(address, (error, value) => {
        if (value === undefined) {
          return reject(new Error('Not found'));
        } else if (error) {
          return reject(error);
        }

        value = JSON.parse(value);

        if (isExpired(value.requestTimeStamp)) {
          resolve(this.saveRequestStarValidation(address));
        } else {
          const data = {
            address: address,
            message: value.message,
            requestTimeStamp: value.requestTimeStamp,
            validationWindow: Math.floor(
              (value.requestTimeStamp - (Date.now() - 5 * 60 * 1000)) / 1000
            )
          };

          resolve(data);
        }
      });
    });
  },

  async validateMessageSignature(address, signature) {
    return new Promise((resolve, reject) => {
      db.get(address, (error, value) => {
        if (value === undefined) {
          return reject(new Error('Not found'));
        } else if (error) {
          return reject(error);
        }

        value = JSON.parse(value);

        if (value.messageSignature === 'valid') {
          return resolve({
            registerStar: true,
            status: value
          });
        } else {
          let isValid = false;

          if (isExpired(value.requestTimeStamp)) {
            value.validationWindow = 0;

            value.messageSignature = 'Validation expired!';
          } else {
            value.validationWindow = Math.floor(
              (value.requestTimeStamp - (Date.now() - 5 * 60 * 1000)) / 1000
            );

            try {
              isValid = bitcoinMessage.verify(
                value.message,
                address,
                signature
              );
            } catch (error) {
              isValid = false;
            }

            value.messageSignature = isValid ? 'valid' : 'invalid';
          }

          db.put(address, JSON.stringify(value));

          return resolve({
            registerStar: !isExpired(value.requestTimeStamp) && isValid,
            status: value
          });
        }
      });
    });
  }
};

module.exports = validatPool;
