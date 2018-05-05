import ether from './zeppelin-solidity/helpers/ether';
import EVMRevert from './zeppelin-solidity/helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const Token = artifacts.require('ICOStartToken');

contract('ICOStartToken', function ([owner, newOwner, other, airdrop1, airdrop2, airdrop3]) {

  const INITIAL_SUPPLY = ether(60000000);
  const TRANSFER_AMOUNT = ether(100000);
  const TRANSFER_AMOUNT2 = ether(100001);
  const TRANSFER_AMOUNT3 = ether(100002);

  beforeEach(async function () {
    this.token = await Token.new(INITIAL_SUPPLY, { from: owner });
    this.token.should.exist;
  });
  
  it('should be owned by its creator', async function () {
    (await this.token.owner()).should.be.equal(owner);
  });

  it('should mint the specified number of tokens', async function () {
    (await this.token.totalSupply()).should.be.bignumber.equal(INITIAL_SUPPLY);
  });

  it('should assign all initially minted tokens to the owner', async function () {
    (await this.token.balanceOf(owner)).should.be.bignumber.equal(INITIAL_SUPPLY);
  });

  it('should lock all tokens initially', async function () {
    (await this.token.locked()).should.be.true;
  });

  it('should automatically whitelist its owner', async function () {
    (await this.token.isWhitelisted(owner)).should.be.true;
  });

  it('should transfer whitelist status together with ownership', async function () {
    (await this.token.isWhitelisted(owner)).should.be.true;
    await this.token.transferOwnership(newOwner).should.be.fulfilled;
    (await this.token.isWhitelisted(owner)).should.be.false;
    (await this.token.isWhitelisted(newOwner)).should.be.true;
  });

  it('should allow whitelisted addresses to transfer tokens', async function () {
    await this.token.transfer(other, TRANSFER_AMOUNT).should.be.fulfilled;    
  });

  it('should not allow non-whitelisted addresses to transfer tokens', async function () {
    await this.token.transfer(other, TRANSFER_AMOUNT).should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should allow transfers after unlocking', async function () {
    await this.token.transfer(other, TRANSFER_AMOUNT).should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.rejectedWith(EVMRevert);
    await this.token.unlock().should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT.div(2), { from: other }).should.be.fulfilled;
    await this.token.multiTransfer([owner], [TRANSFER_AMOUNT.div(2)], { from: other }).should.be.fulfilled;
  });

  it('should not allow transfers after locking', async function () {
    await this.token.transfer(other, TRANSFER_AMOUNT.mul(2)).should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.rejectedWith(EVMRevert);
    await this.token.unlock().should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.fulfilled;
    await this.token.lock().should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.rejectedWith(EVMRevert);
    await this.token.multiTransfer([owner], [TRANSFER_AMOUNT], { from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should allow whitelisted transfers even after locking', async function () {
    await this.token.transfer(other, TRANSFER_AMOUNT.mul(2)).should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.rejectedWith(EVMRevert);
    await this.token.unlock().should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.fulfilled;
    await this.token.lock().should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.rejectedWith(EVMRevert);
    await this.token.addAddressToWhitelist(other, { from: owner }).should.be.fulfilled;
    await this.token.transfer(owner, TRANSFER_AMOUNT, { from: other }).should.be.fulfilled;
  });

  it('should allow burning tokens', async function () {
    await this.token.burn(TRANSFER_AMOUNT).should.be.fulfilled;
  });

  it('should decrease the total supply when tokens are burned', async function () {
    await this.token.burn(TRANSFER_AMOUNT).should.be.fulfilled;
    (await this.token.totalSupply()).should.be.bignumber.equal(INITIAL_SUPPLY.sub(TRANSFER_AMOUNT));
  });

  it('should not allow burning more tokens that the owned amount', async function () {
    await this.token.transfer(other, TRANSFER_AMOUNT).should.be.fulfilled;
    await this.token.burn(TRANSFER_AMOUNT.add(1), { from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should fail on wrong input to multiTransfer', async function () {
    await this.token.multiTransfer([airdrop1, airdrop2, airdrop2], [TRANSFER_AMOUNT, TRANSFER_AMOUNT]).should.be.rejectedWith(EVMRevert);
    await this.token.multiTransfer([airdrop1, airdrop2], [TRANSFER_AMOUNT, -1]).should.be.rejectedWith(EVMRevert);
  });

  it('should transfer the correct amount of tokens to all recipients when multiTransfer is called', async function () {
    await this.token.multiTransfer([airdrop1, airdrop2, airdrop3], [TRANSFER_AMOUNT, TRANSFER_AMOUNT2, TRANSFER_AMOUNT3]).should.be.fulfilled;
    (await this.token.balanceOf(airdrop1)).should.be.bignumber.equal(TRANSFER_AMOUNT);
    (await this.token.balanceOf(airdrop2)).should.be.bignumber.equal(TRANSFER_AMOUNT2);
    (await this.token.balanceOf(airdrop3)).should.be.bignumber.equal(TRANSFER_AMOUNT3);
    const totalAmount = TRANSFER_AMOUNT.add(TRANSFER_AMOUNT2.add(TRANSFER_AMOUNT3));
    (await this.token.balanceOf(owner)).should.be.bignumber.equal(INITIAL_SUPPLY.sub(totalAmount));
  });
  
  it('should transfer the same amount of tokens to all recipients when airdrop is called', async function () {
    await this.token.airdrop([airdrop1, airdrop2, airdrop3], TRANSFER_AMOUNT).should.be.fulfilled;
    (await this.token.balanceOf(airdrop1)).should.be.bignumber.equal(TRANSFER_AMOUNT);
    (await this.token.balanceOf(airdrop2)).should.be.bignumber.equal(TRANSFER_AMOUNT);
    (await this.token.balanceOf(airdrop3)).should.be.bignumber.equal(TRANSFER_AMOUNT);
    (await this.token.balanceOf(owner)).should.be.bignumber.equal(INITIAL_SUPPLY.sub(TRANSFER_AMOUNT.mul(3)));
  });

});
