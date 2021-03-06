const Web3 = require('web3');
const config = require('../config/index.dev')

var web3 = new Web3(new Web3.providers.HttpProvider(config.provider));
var g_nonce = 0;

const eth = {
  createAccount(callback) {
    let account = web3.eth.accounts.create()
    //console.log('eth account info: \n', account)
    callback(null, account)
  },

  getTransactionsForAddress(contractAddress, depositAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.getPastEvents('Transfer', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { _to: depositAddress }
    })
    .then((events) => {
      const returnEvents = events.map((event) => {

        //console.log("\n *** Ethereum Transfer Event ***\n", event)

        //console.log("amout=>\n",parseFloat(web3.utils.fromWei(event.returnValues._value._hex, 'ether')) * 1e12)
        //console.log(event.returnValues._value._hex);
        //console.log("amount 1=>\n",parseFloat(web3.utils.fromWei(event.returnValues._value._hex, 'ether') * 1e12))
        console.log("amount 2=>\n", (event.returnValues._value._hex.toString(10))/1e6);

        let amount = parseFloat(event.returnValues._value._hex.toString(10)/1e6)

        return {
          from: event.returnValues._from,
          to: event.returnValues._to,
          //amount: parseFloat(web3.utils.fromWei(event.returnValues._value._hex, 'ether')),
          amount: amount,
          transactionHash: event.transactionHash
        }
      })
      return callback(null, returnEvents)
    })
    .catch((err) => {
      console.log(err)
      // callback(err)
    });
  },

  getTransactions(contractAddress, accountAddress, depositAddress, depositAmount, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.getPastEvents('Transfer', {
      fromBlock: 0,
      toBlock: 'latest',
      filter: { _to: depositAddress, _from: accountAddress }
    })
    .then((events) => {
      let returnEvents = events.filter((event) => {
        if(event.returnValues._from.toUpperCase() == accountAddress.toUpperCase() && event.returnValues._to.toUpperCase() == depositAddress.toUpperCase()) {
          //let amount = parseFloat(web3.utils.fromWei(event.returnValues._value._hex, 'ether'))
          let amount = parseFloat(web3.utils.fromWei(event.returnValues._value._hex, 'ether'))
          return depositAmount == amount
        }
      })
      callback(null, returnEvents)
    })
    .catch((err) => {
      callback(err)
    });

  },

  getERC20Balance(address, contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.balanceOf(address).call({ from: address })
    .then((balance) => {
      console.log(balance);
      //const theBalance = web3.utils.fromWei(balance.toString(), 'ether')
      const theBalance = balance.toString() 
      //decimals
      myContract.methods.decimals().call({ from: address })
      .then((decimals) => {
        var base = Math.pow(10,parseInt(decimals.toString(10)))
        callback(null, theBalance/base)
      })
    })
    .catch(callback)
  },

  async getERC20Decimals(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.decimals().call({ from: contractAddress })
    .then((decimals) => {
      //var base = 10 * decimals
      callback(null, decimals.toString(10))
    })
    .catch(callback)
  },

  getERC20Symbol(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.symbol().call({ from: contractAddress })
    .then((symbol) => {
      console.log(symbol);

      callback(null, symbol)
    })
    .catch(callback)
  },

  getERC20Name(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.name().call({ from: contractAddress })
    .then((name) => {
      console.log(name);

      callback(null, name)
    })
    .catch(callback)
  },

  getERC20TotalSupply(contractAddress, callback) {
    let myContract = new web3.eth.Contract(config.erc20ABI, contractAddress)

    myContract.methods.totalSupply().call({ from: contractAddress })
    .then((supply) => {
      if(!supply) {
        return callback(null, null)
      }

      console.log(supply.toString(10));
      //const theSupply = web3.utils.fromWei(supply.toString(), 'ether')
      const theSupply = supply.toString(10)

      //decimals
      myContract.methods.decimals().call({ from: contractAddress })
      .then((decimals) => {
        
        var base = Math.pow(10,parseInt(decimals.toString(10)))
        callback(null, theSupply/base)
      })
      //callback(null, theSupply)
    })
    .catch(callback)
  },

  async initNonce(from){
    let nonce = await web3.eth.getTransactionCount(from,'pending');
    console.log('\nnonce =>  ',nonce)
    if(nonce > g_nonce){
      g_nonce = nonce;
    }
  },

  async sendTransaction(contractAddress, privateKey, from, to, amount, callback) {

    //let sendAmount = web3.utils.toWei(amount, 'ether')
    //let sendAmount = amount * 1e6;
    let sendAmount = amount*1e6; 
    //for error test
    if(g_nonce > 0){
      //sendAmount = amount*1e16;  
    }
    console.log('eth sendAmount => ', sendAmount);
    console.log('eth sendAmount int => ', parseInt(sendAmount));

    const consumerContract = new web3.eth.Contract(config.erc20ABI, contractAddress);
    const myData = consumerContract.methods.transfer(to, "0x"+sendAmount.toString(16)).encodeABI();
    //const nonce = await web3.eth.getTransactionCount(from,'pending');
    //console.log('\nnonce =>  ',nonce)

    const tx = {
      from,
      to: contractAddress,
      value: '0',
      gasPrice: web3.utils.toWei('25', 'gwei'),
      gas: 60000,
      chainId: 3,
      nonce: g_nonce++,
      data: myData
    }

    console.log('tx => \n', tx)
    console.log('privateKey=> ', privateKey)

    const signed = await web3.eth.accounts.signTransaction(tx, privateKey)
    const rawTx = signed.rawTransaction

    const sendRawTx = rawTx =>
      new Promise((resolve, reject) =>
        web3.eth
          .sendSignedTransaction(rawTx)
          .on('transactionHash', resolve)
          .on('error', reject)
      )

    const result = await sendRawTx(rawTx).catch((err) => {
      console.log("eth sendRawTx error\n", err)
      return err
    })

    console.log('eth sendtx result => ',result);

    if(result.toString().includes('Error')) {
      callback(result.toString(), null)
    } else {
      callback(null, result.toString())
    }

  },
}

module.exports = eth
