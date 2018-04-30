require('babel-register');
require('babel-polyfill');

module.exports = {
  solc: {
    optimizer: {
      enabled: true,
      runs: 200
    }
  },
  networks: {
    development: {
      host: "localhost",
      port: 7545,
      network_id: 5777 // Ganache
    },
    ropsten: {
      host: "localhost",
      port: 9545,
      network_id: 3, // Ropsten network
      gas: 5500000
    },
    live: {
      //host: "192.168.1.103",
      //host: "10.9.86.162",
      host: "10.10.10.9",
      port: 8545,
      network_id: 1,        // Ethereum public network
      gas: 6500000,
      from: "0x002Fe928c25A5A5D4E919730f27925d24B2410B5"
    }
  }
};
