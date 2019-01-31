/* ===== SHA256 with Crypto-js ===============================
|  Learn more: Crypto-js: https://github.com/brix/crypto-js  |
|  =========================================================*/
const SHA256 = require('crypto-js/sha256');
const { Block } = require('./block.js');
const db = require('level')('./data/chain');
const util = require('./util.js');

/* ===== Level Helpers ==============================
|  Pulling in Helpers for level DB        			   |
|  Copied from levelSandbox               			   |
|  ===============================================*/

// Add data to levelDB with key/value pair
addLevelDBData = async (key, value) => {
  return new Promise((resolve, reject) => {
    db.put(key, value)
      .then(() => {
        db.get(key)
          .then(block => {
            resolve(block);
          })
          .catch(err => {
            reject(err);
          });
      })
      .catch(err => {
        reject(err);
      });
  });
};

// Get data from levelDB with key
getLevelDBData = key => {
  return new Promise((resolve, reject) => {
    db.get(key, (err, value) => {
      if (err) {
        console.log('Not found!', err);
        reject(err);
      } else {
        // console.log('Value = ' + value)  // DEBUG
        resolve(value);
      }
    });
  });
};

getBlockHeight = () => {
  return new Promise((resolve, reject) => {
    let height = -1;

    db.createReadStream()
      .on('data', data => {
        height++;
      })
      .on('error', error => {
        reject(error);
      })
      .on('close', () => {
        resolve(height);
      });
  });
};

/* ===== Blockchain Class ==========================
|  Class with a constructor for new blockchain 		|
|  ================================================*/

class Blockchain {
  constructor() {
    this.getBlockHeight().then(height => {
      if (height === -1) {
        let genesisBlock = new Block('Genesis Block');
        this.addBlock(genesisBlock)
          .then(block => {
            console.log('-------- THE GENESIS BLOCK --------');
            console.log(block);
          })
          .catch(err => {
            console.log(err);
          });
      }
    });
  }

  // Helpers
  async getBlockHeight() {
    var height = await getBlockHeight();
    return height;
  }

  async getBlock(blockHeight) {
    let block = JSON.parse(await getLevelDBData(blockHeight));

    // verify if ins't the Genesis block
    if (parseInt(block.height) > 0) {
      block.body.star.storyDecoded = Buffer.from(
        block.body.star.story,
        'hex'
      ).toString();
    }
    return block; // returns block at blockHeight as a JSON object
  }

  // get block by address
  async getBlocksByAddress(address) {
    const blocks = [];
    let block = {};

    return new Promise((resolve, reject) => {
      db.createReadStream()
        .on('data', data => {
          if (data.key !== 0) {
            block = JSON.parse(data.value);

            if (block.body.address === address) {
              block.body.star.storyDecoded = Buffer.from(
                block.body.star.story,
                'hex'
              ).toString();
              blocks.push(block);
            }
          }
        })
        .on('error', error => {
          return reject(error);
        })
        .on('close', () => {
          return resolve(blocks);
        });
    });
  }

  // get block by address
  async getBlockByHash(hash) {
    let block = {};

    return new Promise((resolve, reject) => {
      db.createReadStream()
        .on('data', data => {
          block = JSON.parse(data.value);

          if (util.isStringChainEquals(block.hash, hash)) {
            if (data.key !== 0) {
              block.body.star.storyDecoded = Buffer.from(
                block.body.star.story,
                'hex'
              ).toString();
              return resolve(block);
            } else {
              return resolve(block);
            }
          }
        })
        .on('error', error => {
          return reject(error);
        })
        .on('close', () => {
          return reject('Block not found');
        });
    });
  }

  // Add new block
  async addBlock(newBlock) {
    let previousBlockHeight = parseInt(await this.getBlockHeight());
    // Block height
    newBlock.height = previousBlockHeight + 1;
    // UTC timestamp
    newBlock.time = new Date()
      .getTime()
      .toString()
      .slice(0, -3);
    // previous block hash
    if (newBlock.height > 0) {
      let previousBlock = await this.getBlock(previousBlockHeight);
      newBlock.previousBlockHash = previousBlock.hash;
    }
    // Block hash with SHA256 using newBlock and converting to a string
    newBlock.hash = SHA256(JSON.stringify(newBlock)).toString();

    // Adding block object to levelDB
    await addLevelDBData(newBlock.height, JSON.stringify(newBlock));

    // return the new block
    return newBlock;
  }

  // validate block
  async validateBlock(blockHeight) {
    let block = await this.getBlock(blockHeight);
    block = JSON.parse(block);
    let blockHash = block.hash;
    block.hash = '';

    let validBlockHash = SHA256(JSON.stringify(block)).toString();

    if (blockHash === validBlockHash) {
      return true;
    } else {
      console.log('Block # ' + blockHeight + ' invalid hash:');
      return false;
    }
  }

  // Validate blockchain
  async validateChain() {
    let previousHash = '';
    let hasError = false;

    const height = await this.getBlockHeight();

    for (let i = 0; i <= height; i++) {
      this.getBlock(i).then(async block => {
        block = JSON.parse(block);
        const isValidBlock = await this.validateBlock(block.height);

        if (!isValidBlock) {
          console.log('error on block: ' + i);
          hasError = true;
        }

        if (block.previousBlockHash !== previousHash) {
          console.log('error previous block hash on block: ' + i);
          hasError = true;
        }

        previousHash = block.hash;

        if (!hasError) {
          console.log('BLOCKCHAIN VALIDATED');
        }
      });
    }
  }
}

module.exports = { Blockchain };
