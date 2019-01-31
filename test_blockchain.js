const { Blockchain } = require('./blockchain.js');
const { Block } = require('./block.js');

let myBlockChain = new Blockchain();

(function theLoop(i) {
  setTimeout(function() {
    let blockTest = new Block('Test Block - ' + (i + 1));
    myBlockChain.addBlock(blockTest).then(result => {
      console.log(result);
      i++;
      if (i < 5) theLoop(i);
    });
  }, 10000);
})(0);
