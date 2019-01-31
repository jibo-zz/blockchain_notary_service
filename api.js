/* ===== Configure =========================================
|  API Service Port Configuration  |
|  =========================================================*/
const { check, validationResult } = require('express-validator/check');
const express = require('express');
const app = express();

const { Blockchain } = require('./blockchain.js');
const { Block } = require('./block.js');
const blockchain = new Blockchain();

const validatPool = require('./validation.js');
const util = require('./util.js');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ===== POST Validate User Request  =========================================
|  URL post http://localhost:8000/requestValidation  |
|  =========================================================*/
app.post(
  '/requestValidation',
  [
    check('address')
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    let data = {};

    try {
      data = await validatPool.getPendingAddress(req.body.address);
    } catch (err) {
      console.log(err);
      data = await validatPool.saveRequestStarValidation(req.body.address);
    }

    res.json(data);
  }
);

/* ===== POST Validate User message signature  =========================================
|  URL post http://localhost:8000/message-signature/validate  |
|  =========================================================*/
app.post(
  '/message-signature/validate',
  [
    check('address')
      .not()
      .isEmpty(),

    check('signature')
      .not()
      .isEmpty()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const response = await validatPool.validateMessageSignature(
        req.body.address,
        req.body.signature
      );

      if (response.registerStar) {
        res.json(response);
      } else {
        res.status(401).json(response);
      }
    } catch (error) {
      res.status(404).json({
        status: 404,
        message: error.message
      });
    }
  }
);

/* ===== GET Address  =========================================
|  http://localhost:8000/stars/address:address
|  =========================================================*/
app.get('/stars/address:address', async (req, res) => {
  blockchain
    .getBlocksByAddress(req.params.address.slice(1))
    .then(success => {
      res.send(success);
    })
    .catch(() => {
      res.status(404).json({
        status: 404,
        message: 'Block not found'
      });
    });
});

/* ===== GET Hash  =========================================
|   http://localhost:8000/stars/hash:hash
|  =========================================================*/
app.get('/stars/hash:hash', async (req, res) => {
  blockchain
    .getBlockByHash(req.params.hash.slice(1))
    .then(success => {
      res.send(success);
    })
    .catch(() => {
      res.status(404).json({
        status: 404,
        message: 'Block not found'
      });
    });
});

/* ===== GET Block  =========================================
|  GET Block endpoint using URL path with block height parameter  |
|  =========================================================*/
app.get('/block/:blockHeight', (req, res) => {
  blockchain
    .getBlock(req.params.blockHeight)
    .then(success => {
      // The block contents must respond to GET request with block contents in JSON format
      res.json(success);
    })
    .catch(() => {
      res.status(404).json({
        status: 404,
        message: 'Block not found'
      });
    });
});

/* ===== POST Block  =========================================
| POST Block endpoint using key/value pair within request body  |
|  =========================================================*/
app.post(
  '/block',
  [
    check('address')
      .not()
      .isEmpty(),

    check('star').custom(star => {
      if (util.empty(star)) {
        return Promise.reject('Star object is required');
      }
      if (util.empty(star.ra)) {
        return Promise.reject('Ra is required');
      }
      if (util.empty(star.dec)) {
        return Promise.reject('Dec is required');
      }
      if (util.empty(star.story)) {
        return Promise.reject('Story is required');
      }
      if (star.story.length > 500) {
        return Promise.reject(
          'Story is limited to 500 words. Maximum size is 500 bytes'
        );
      }
      if (!util.isASCII(star.story)) {
        return Promise.reject('Story contains non-ASCII symbols');
      }
      return true;
    })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const isValid = await validatPool.isValidSignature(req.body.address);

      if (!isValid) {
        throw new Error('Signature is not valid');
      }
    } catch (error) {
      res.status(401).json({
        status: 401,
        message: error.message
      });

      return;
    }

    let star = req.body.star;

    star.story = Buffer.from(req.body.star.story).toString('hex');

    const block = {
      address: req.body.address,
      star: star
    };

    blockchain
      .addBlock(new Block(block))
      .then(success => {
        validatPool.invalidateSignature(req.body.address);

        res.status(201).send(success);
      })
      .catch(() => {
        res.json({ error: 'There was an error generating a new block' });
      });
  }
);

/* ===== server  =========================================
| Starting server  |
|  =========================================================*/
app.listen(8000, () => console.log('API listening on port 8000'));
app.get('/', (req, res) =>
  res.status(404).json({
    status: 404,
    message: 'Check the README.md for the accepted endpoints'
  })
);
