import ether from './zeppelin-solidity/helpers/ether';
import { advanceBlock } from './zeppelin-solidity/helpers/advanceToBlock'
import { increaseTimeTo, duration } from './zeppelin-solidity/helpers/increaseTime'
import latestTime from './zeppelin-solidity/helpers/latestTime'
import EVMRevert from './zeppelin-solidity/helpers/EVMRevert';

const BigNumber = web3.BigNumber;

const should = require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should();

const Token = artifacts.require('ICOStartToken');
const Sale = artifacts.require('ICOStartSale');

contract('ICOStartSale', function ([owner, newOwner, whiteListedInvestor, nonWhiteListedInvestor, wallet, other]) {

  const TOTAL_SUPPLY = ether(60000); // tokens
  const SALE_SUPPLY = ether(30000); // tokens

  const RATE1 = new BigNumber(4000); // tokens per eth
  const RATE2 = new BigNumber(3000); // tokens per eth
  const RATE3 = new BigNumber(2000); // tokens per eth
  const RATE4 = new BigNumber(1000); // tokens per eth

  const TOTAL_AMOUNT1 = SALE_SUPPLY.div(RATE1);
  const EXPECTED_TOTAL_TOKEN_AMOUNT1 = RATE1.mul(TOTAL_AMOUNT1); // token

  const INVESTED_VERY_SMALL_AMOUNT = ether(0.04); // ether
  const INVESTED_MINIMUM_AMOUNT = ether(0.05); // ether
  const INVESTED_AMOUNT = ether(1); // ether
  const EXPECTED_TOKEN_AMOUNT1 = RATE1.mul(INVESTED_AMOUNT); // token
  const EXPECTED_TOKEN_AMOUNT2 = RATE2.mul(INVESTED_AMOUNT); // token
  const EXPECTED_TOKEN_AMOUNT3 = RATE3.mul(INVESTED_AMOUNT); // token
  const EXPECTED_TOKEN_AMOUNT4 = RATE4.mul(INVESTED_AMOUNT); // token
  const INVESTED_BIG_AMOUNT = ether(6); // ether
  const EXPECTED_TOKEN_BIG_AMOUNT1 = RATE1.mul(INVESTED_BIG_AMOUNT); // token
  const EXPECTED_TOKEN_BIG_AMOUNT2 = RATE2.mul(INVESTED_BIG_AMOUNT); // token

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function
    await advanceBlock();
  })

  beforeEach(async function () {
    // 4 periods, one week each.
    this.start1 = latestTime() + duration.weeks(1);
    this.end1 = this.start1 + duration.weeks(1);
    this.start2 = this.end1 + duration.seconds(1);
    this.end2 = this.start2 + duration.weeks(1);
    this.start3 = this.end2 + duration.seconds(1);
    this.end3 = this.start3 + duration.weeks(1);
    this.start4 = this.end3 + duration.seconds(1);
    this.end4 = this.start4 + duration.weeks(1);
    
    this.beforeStart = this.start1 - duration.hours(1);
    this.beforeEnd = this.end2 - duration.hours(1);
    this.afterEnd = this.end4 + duration.seconds(1);

    this.token = await Token.new(TOTAL_SUPPLY, { from: owner });
    this.token.should.exist;
    
    this.sale = await Sale.new(wallet, this.token.address, owner, { from: owner });
    this.sale.should.exist;
    await this.token.approve(this.sale.address, SALE_SUPPLY, { from: owner });

    // Sale periods.
    await this.sale.addPeriod(this.start1, this.end1, RATE1, { from: owner });
    await this.sale.addPeriod(this.start2, this.end2, RATE2, { from: owner });
    await this.sale.addPeriod(this.start3, this.end3, RATE3, { from: owner });
    await this.sale.addPeriod(this.start4, this.end4, RATE4, { from: owner });

    // Sale is setup with a small white list of 1 whiteListedInvestor.
    // Taking a chance to exercise addAddressesToWhitelist here as addAddressToWhitelist is tested elsewhere.
    await this.sale.addAddressesToWhitelist([whiteListedInvestor], 0, { from: owner });

    await this.token.unlock();
  });

  it('should create sale with correct parameters', async function () {
    (await this.sale.owner()).should.be.equal(owner);
    (await this.sale.token()).should.be.equal(this.token.address);
    (await this.sale.wallet()).should.be.equal(wallet);
    (await this.sale.tokenWallet()).should.be.equal(owner);
    (await this.sale.isAddressInWhitelist(whiteListedInvestor)).should.be.true;
    (await this.sale.remainingTokens()).should.be.bignumber.equal(SALE_SUPPLY);
    (await this.token.balanceOf(owner)).should.be.bignumber.equal(TOTAL_SUPPLY);
    (await this.token.allowance(owner, this.sale.address)).should.be.bignumber.equal(SALE_SUPPLY);
    (await this.token.isWhitelisted(owner)).should.be.true;
  });

  it('should not be open before the start of the first period', async function () {
    await increaseTimeTo(this.beforeStart);
    (await this.sale.isOpen()).should.be.false;
  });

  it('should not be open after the end of the last period', async function () {
    await increaseTimeTo(this.afterEnd);
    (await this.sale.isOpen()).should.be.false;
  });

  it('should be open inside periods', async function () {
    await increaseTimeTo(this.start1);
    (await this.sale.isOpen()).should.be.true;
    await increaseTimeTo(this.start2);
    (await this.sale.isOpen()).should.be.true;
  });

  it('should not accept payments before start', async function () {
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept big payments during the sale', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.sendTransaction({ value: INVESTED_BIG_AMOUNT, from: whiteListedInvestor }).should.be.fulfilled;
  });

  it('should accept payments during the sale', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: nonWhiteListedInvestor }).should.be.fulfilled;
  });

  it('should reject big payments after end', async function () {
    await increaseTimeTo(this.afterEnd);
    await this.sale.sendTransaction({ value: INVESTED_BIG_AMOUNT, from: whiteListedInvestor }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject payments after end', async function () {
    await increaseTimeTo(this.afterEnd);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: nonWhiteListedInvestor }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject big payments by non-whitelisted investors', async function () {
    await increaseTimeTo(this.start1);
    (await this.sale.isAddressInWhitelist(nonWhiteListedInvestor)).should.be.false;
    await this.sale.sendTransaction({ value: INVESTED_BIG_AMOUNT, from: nonWhiteListedInvestor }).should.be.rejectedWith(EVMRevert);
  });

  it('should actually add addresses to the whitelist', async function () {
    await this.sale.addAddressToWhitelist(other, 0);
    (await this.sale.isAddressInWhitelist(other)).should.be.true;
  });

  it('should accept big payments by newly-whitelisted investors', async function () {
    await increaseTimeTo(this.start1);

    await this.sale.addAddressToWhitelist(other, 0, { from: owner });
    await this.sale.sendTransaction({ value: INVESTED_BIG_AMOUNT, from: other }).should.be.fulfilled;
  });

  it('should accept small payments', async function () {
    await increaseTimeTo(this.start1);

    await this.sale.sendTransaction({ value: INVESTED_MINIMUM_AMOUNT, from: other }).should.be.fulfilled;
  });

  it('should reject very small payments', async function () {
    await increaseTimeTo(this.start1);

    await this.sale.sendTransaction({ value: INVESTED_VERY_SMALL_AMOUNT, from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject payments if periods are deleted', async function () {
    await this.sale.clearPeriods({ from: owner });

    await increaseTimeTo(this.start1);

    await this.sale.sendTransaction({ value: INVESTED_MINIMUM_AMOUNT, from: other }).should.be.rejectedWith(EVMRevert);
  });
 
  it('should allow buying tokens upto the total available amount', async function () {
    await increaseTimeTo(this.start1);

    await this.sale.sendTransaction({ value: TOTAL_AMOUNT1, from: whiteListedInvestor }).should.be.fulfilled;
  });

  it('should reject payments if all tokens are sold', async function () {
    await increaseTimeTo(this.start1);

    await this.sale.sendTransaction({ value: TOTAL_AMOUNT1, from: whiteListedInvestor }).should.be.fulfilled;
    await this.sale.sendTransaction({ value: INVESTED_MINIMUM_AMOUNT, from: whiteListedInvestor }).should.be.rejectedWith(EVMRevert);
  });

  it('should transfer bought tokens to the beneficiary', async function () {
    await increaseTimeTo(this.start1);
    const balanceBefore = await this.token.balanceOf(whiteListedInvestor);
    balanceBefore.should.be.bignumber.equal(0);
    await this.sale.sendTransaction({ from: whiteListedInvestor, value: INVESTED_BIG_AMOUNT }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(whiteListedInvestor);
    balanceAfter.should.be.bignumber.equal(EXPECTED_TOKEN_BIG_AMOUNT1);
  });

  it('should transfer bought tokens from the owner', async function () {
    await increaseTimeTo(this.start1);
    const ownerBalanceBefore = await this.token.balanceOf(owner);
    await this.sale.sendTransaction({ from: whiteListedInvestor, value: INVESTED_BIG_AMOUNT }).should.be.fulfilled;
    const ownerBalanceAfter = await this.token.balanceOf(owner);
    ownerBalanceAfter.should.be.bignumber.equal(ownerBalanceBefore.minus(EXPECTED_TOKEN_BIG_AMOUNT1));
  });

  it('should apply a custom rate if defined for a particular whitelisted investor', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.addAddressToWhitelist(other, RATE4, { from: owner });
    const balanceBefore = await this.token.balanceOf(other);
    balanceBefore.should.be.bignumber.equal(0);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: other }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(other);
    balanceAfter.should.be.bignumber.equal(EXPECTED_TOKEN_AMOUNT4);
  });

  it('should apply a custom rate if modified for a previously whitelisted investor', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.addAddressToWhitelist(whiteListedInvestor, RATE4, { from: owner });
    const balanceBefore = await this.token.balanceOf(whiteListedInvestor);
    balanceBefore.should.be.bignumber.equal(0);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: whiteListedInvestor }).should.be.fulfilled;
    const balanceAfter = await this.token.balanceOf(whiteListedInvestor);
    balanceAfter.should.be.bignumber.equal(EXPECTED_TOKEN_AMOUNT4);
  });

  it('should only accept small payments from no longer whitelisted investors', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.removeAddressFromWhitelist(whiteListedInvestor, { from: owner });
    await this.sale.sendTransaction({ value: INVESTED_BIG_AMOUNT, from: whiteListedInvestor }).should.be.rejectedWith(EVMRevert);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: whiteListedInvestor }).should.be.fulfilled;
  });

  it('should remove any custom rate as well when an investor is removed from the whitelist', async function () {
    await increaseTimeTo(this.start1);

    // Add with custom rate
    await this.sale.addAddressToWhitelist(other, RATE4, { from: owner });
    let balanceBefore = await this.token.balanceOf(other);
    balanceBefore.should.be.bignumber.equal(0);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: other }).should.be.fulfilled;
    let balanceAfter = await this.token.balanceOf(other);
    balanceAfter.should.be.bignumber.equal(EXPECTED_TOKEN_AMOUNT4);

    // Remove - standard rate should be restored
    await this.sale.removeAddressFromWhitelist(other, { from: owner });
    balanceBefore = await this.token.balanceOf(other);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: other }).should.be.fulfilled;
    balanceAfter = await this.token.balanceOf(other);
    balanceAfter.should.be.bignumber.equal(balanceBefore.add(EXPECTED_TOKEN_AMOUNT1));

    // Re-add without custom rate - standard rate should still apply.
    await this.sale.addAddressToWhitelist(other, 0, { from: owner });
    balanceBefore = await this.token.balanceOf(other);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: other }).should.be.fulfilled;
    balanceAfter = await this.token.balanceOf(other);
    balanceAfter.should.be.bignumber.equal(balanceBefore.add(EXPECTED_TOKEN_AMOUNT1));

    // Change rate - see that it applies.
    await this.sale.addAddressToWhitelist(other, RATE3, { from: owner });
    balanceBefore = await this.token.balanceOf(other);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: other }).should.be.fulfilled;
    balanceAfter = await this.token.balanceOf(other);
    balanceAfter.should.be.bignumber.equal(balanceBefore.add(EXPECTED_TOKEN_AMOUNT3));
  });

  it('should not accept payments when paused', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.pause({ from: owner });
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: whiteListedInvestor }).should.be.rejectedWith(EVMRevert);
  });

  it('should update the remaining token counter after each sale', async function () {
    await increaseTimeTo(this.start1);
    await this.sale.sendTransaction({ value: INVESTED_AMOUNT, from: nonWhiteListedInvestor });
    (await this.sale.remainingTokens()).should.be.bignumber.equal(SALE_SUPPLY.sub(EXPECTED_TOKEN_AMOUNT1));
  });

  it('should allow owner to withdraw all unsold tokens', async function () {
    await increaseTimeTo(this.start1);
    await this.token.approve(this.sale.address, 0, { from: owner });
    (await this.sale.remainingTokens()).should.be.bignumber.equal(0);
  });

});
