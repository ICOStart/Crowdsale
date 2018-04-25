var Token = artifacts.require("ICOStartToken");

module.exports = function(deployer) {
  deployer.deploy(Token,
  web3.toWei(60000000, 'ether') /* _initialSupply */);
};
