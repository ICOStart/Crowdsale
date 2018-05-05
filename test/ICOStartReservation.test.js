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
const Reservation = artifacts.require('ICOStartReservation');

contract('ICOStartReservation', function ([owner, manager, wallet, contributor1, contributor2, contributor3, other]) {

  const TOTAL_SUPPLY = ether(60000); // tokens
  const SALE_SUPPLY = ether(30000); // tokens

  const RATE1 = new BigNumber(100); // tokens per eth

  const RESERVATION_FEE_PERC = new BigNumber(5); // 0-100
  const RESERVATION_CAP = ether(20); // ether
  const RESERVATION_RATE = new BigNumber(200); // tokens per eth
  const RESERVATION_NET_AMOUNT = RESERVATION_CAP.sub(RESERVATION_CAP.div(100).mul(RESERVATION_FEE_PERC));
  const RESERVATION_TOKEN_AMOUNT = RESERVATION_NET_AMOUNT.mul(RESERVATION_RATE); // token

  const INVESTED_AMOUNT = ether(1); // ether
  const INVESTED_NET_AMOUNT = INVESTED_AMOUNT.sub(INVESTED_AMOUNT.div(100).mul(RESERVATION_FEE_PERC));
  const EXPECTED_TOKEN_AMOUNT = RESERVATION_RATE.mul(INVESTED_NET_AMOUNT); // token

  const INVESTED_AMOUNT2 = ether(2); // ether
  const INVESTED_NET_AMOUNT2 = INVESTED_AMOUNT2.sub(INVESTED_AMOUNT2.div(100).mul(RESERVATION_FEE_PERC));
  const EXPECTED_TOKEN_AMOUNT2 = RESERVATION_RATE.mul(INVESTED_NET_AMOUNT2); // token

  const INVESTED_BIG_AMOUNT = ether(6); // ether
  const INVESTED_NET_BIG_AMOUNT = INVESTED_BIG_AMOUNT.sub(INVESTED_BIG_AMOUNT.div(100).mul(RESERVATION_FEE_PERC));
  const EXPECTED_TOKENS_BIG_AMOUNT = RESERVATION_RATE.mul(INVESTED_NET_BIG_AMOUNT); // token

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function
    await advanceBlock();
  })

  beforeEach(async function () {
    // 1 period just to get things going.
    this.start1 = latestTime() + duration.weeks(1);
    this.end1 = this.start1 + duration.weeks(1);
    
    this.beforeStart = this.start1 - duration.hours(1);
    this.beforeEnd = this.end2 - duration.hours(1);
    this.afterEnd = this.end4 + duration.seconds(1);

    this.token = await Token.new(TOTAL_SUPPLY, { from: owner });
    this.token.should.exist;
    
    this.sale = await Sale.new(wallet, this.token.address, owner, { from: owner });
    this.sale.should.exist;
    await this.token.approve(this.sale.address, SALE_SUPPLY, { from: owner });
    await this.sale.addPeriod(this.start1, this.end1, RATE1, { from: owner });

    this.reservation = await Reservation.new(this.sale.address, RESERVATION_CAP, RESERVATION_FEE_PERC, manager, { from: owner });
    this.reservation.should.exist;

    // Whitelist the reservation contract.
    await this.sale.addAddressToWhitelist(this.reservation.address, RESERVATION_RATE, { from: owner });

    await this.token.unlock();
  });

  it('should create reservation with correct parameters', async function () {
    (await this.reservation.owner()).should.be.equal(owner);
    (await this.reservation.sale()).should.be.equal(this.sale.address);
    (await this.reservation.cap()).should.be.bignumber.equal(RESERVATION_CAP);
    (await this.reservation.getToken()).should.be.equal(this.token.address);
    (await this.reservation.feePerc()).should.be.bignumber.equal(RESERVATION_FEE_PERC);
    (await this.reservation.manager()).should.be.equal(manager);
    (await this.sale.isAddressInWhitelist(this.reservation.address)).should.be.true;
    (await this.reservation.isOpen()).should.be.true;
    (await this.reservation.paid()).should.be.false;
    (await this.reservation.paused()).should.be.false;
    (await this.reservation.canceled()).should.be.false;
  });

  it('should accept deposits right away', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT }).should.be.fulfilled;
  });

  it('should not accept deposits when paused', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pause({ from: owner });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept deposits when unpaused', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pause({ from: owner });
    await this.reservation.unpause({ from: owner });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT }).should.be.fulfilled;
  });

  it('should keep track of total deposited amount', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT }).should.be.fulfilled;
    (await this.reservation.weiCollected()).should.be.bignumber.equal(INVESTED_AMOUNT);
  });

  it('should keep track of each contributor\'s deposited amount', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 }).should.be.fulfilled;
    (await this.reservation.deposits(contributor1)).should.be.bignumber.equal(INVESTED_AMOUNT);
  });

  it('should detect when cap is reached', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: RESERVATION_CAP, from: contributor1 }).should.be.fulfilled;
    (await this.reservation.capReached()).should.be.true;
  });

  it('should stop accepting deposits once cap is reached', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: RESERVATION_CAP, from: contributor1 }).should.be.fulfilled;
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor2 }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept deposits that would get the balance over the cap', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: 1, from: contributor1 }).should.be.fulfilled;
    await this.reservation.sendTransaction({ value: RESERVATION_CAP, from: contributor2 }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject cancel requests unless paused', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.cancel({ from: owner }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject pause requests from addresses other than the owner', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pause({ from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject cancel requests from addresses other than the owner', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pause({ from: owner });
    await this.reservation.cancel({ from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should allow cancel requests when paused', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pause({ from: owner });
    await this.reservation.cancel({ from: owner }).should.be.fulfilled;
  });

  it('should not accept deposits when canceled', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pause({ from: owner });
    await this.reservation.cancel({ from: owner });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept withdrawals when not canceled', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.withdraw({ from: contributor3 }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept withdrawals when canceled', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.pause({ from: owner });
    await this.reservation.cancel({ from: owner });
    await this.reservation.withdraw({ from: contributor3 }).should.be.fulfilled;
  });

  it('should send the exact amount back if a withdraw is requested', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.pause({ from: owner });
    await this.reservation.cancel({ from: owner });
    // Need to use a fixed gas price so we can compute the tx cost exactly.
    const fixedGasPrice = new BigNumber(15000000000);
    const initialBalance = await web3.eth.getBalance(contributor3);
    const result = await this.reservation.withdraw({ from: contributor3, gasPrice: fixedGasPrice }).should.be.fulfilled;
    const gasUsed = new BigNumber(result.receipt.gasUsed);
    const txCost = gasUsed.mul(fixedGasPrice);
    const finalBalance = await web3.eth.getBalance(contributor3);
    finalBalance.should.be.bignumber.equal(initialBalance.add(INVESTED_AMOUNT).sub(txCost));
  });

  it('should reject pay requests if no funds were collected', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.pay({ from: owner }).should.be.rejectedWith(EVMRevert);
  });

  it('should reject pay requests from addresses other than the owner', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 });
    await this.reservation.pay({ from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept pay requests from the owner', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT2, from: contributor2 });
    await this.reservation.pay({ from: owner }).should.be.fulfilled;
  });

  it('should send all funds when paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT2, from: contributor2 });
    await this.reservation.pay({ from: owner });
    (await web3.eth.getBalance(this.reservation.address)).should.be.bignumber.equal(0);
  });

  it('should send the correct amount of funds to the sale when paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT2, from: contributor2 });
    const initialBalance = await web3.eth.getBalance(wallet);
    await this.reservation.pay({ from: owner });
    const totalAmount = INVESTED_AMOUNT.add(INVESTED_AMOUNT2);
    const totalNetAmount = totalAmount.sub(totalAmount.div(100).mul(RESERVATION_FEE_PERC));
    const finalBalance = await web3.eth.getBalance(wallet);
    finalBalance.should.be.bignumber.equal(initialBalance.add(totalNetAmount));
  });

  it('should send the correct fee to the manager when paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT2, from: contributor2 });
    const initialBalance = await web3.eth.getBalance(manager);
    await this.reservation.pay({ from: owner });
    const totalAmount = INVESTED_AMOUNT.add(INVESTED_AMOUNT2);
    const totalFee = totalAmount.div(100).mul(RESERVATION_FEE_PERC);
    const finalBalance = await web3.eth.getBalance(manager);
    finalBalance.should.be.bignumber.equal(initialBalance.add(totalFee));
  });

  it('should be paid after paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.pay({ from: owner });
    (await this.reservation.paid()).should.be.true;
  });

  it('should not accept deposits after paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.pay({ from: owner });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept (direct) claim requests before paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.claimTokens(contributor3, { from: contributor3 }).should.be.rejectedWith(EVMRevert);
  });

  it('should not accept (indirect) claim requests after paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.sendTransaction({ value: 0, from: contributor3 }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept (direct) claim requests after paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.pay({ from: owner });
    await this.reservation.claimTokens(contributor3, { from: contributor3 }).should.be.fulfilled;
  });

  it('should accept (indirect) claim requests after paying', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor3 });
    await this.reservation.pay({ from: owner });
    await this.reservation.sendTransaction({ value: 0, from: contributor3 }).should.be.fulfilled;
  });

  it('should distribute the expected number of tokens upon claim', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor1 });
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT2, from: contributor2 });
    await this.reservation.pay({ from: owner });
    await this.reservation.claimTokens(contributor1, { from: contributor1 }).should.be.fulfilled;
    (await this.token.balanceOf(contributor1)).should.be.bignumber.equal(EXPECTED_TOKEN_AMOUNT);
    await this.reservation.claimTokens(contributor2, { from: contributor2 }).should.be.fulfilled;
    (await this.token.balanceOf(contributor2)).should.be.bignumber.equal(EXPECTED_TOKEN_AMOUNT2);
  });

  it('should reject destroy requests from addresses other than the owner', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.destroy({ from: other }).should.be.rejectedWith(EVMRevert);
  });

  it('should accept destroy requests from the owner', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.destroy({ from: owner }).should.be.fulfilled;
  });

  it('should send all funds to the owner when destroyed', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor2 });
    // Need to use a fixed gas price so we can compute the tx cost exactly.
    const fixedGasPrice = new BigNumber(15000000000);
    const initialBalance = await web3.eth.getBalance(owner);
    const result = await this.reservation.destroy({ from: owner, gasPrice: fixedGasPrice });
    const gasUsed = new BigNumber(result.receipt.gasUsed);
    const txCost = gasUsed.mul(fixedGasPrice);
    const finalBalance = await web3.eth.getBalance(owner);
    finalBalance.should.be.bignumber.equal(initialBalance.add(INVESTED_AMOUNT).sub(txCost));
  });

  it('should send all tokens to the owner when destroyed', async function () {
    await increaseTimeTo(this.start1);
    await this.reservation.sendTransaction({ value: INVESTED_AMOUNT, from: contributor2 });
    await this.reservation.pay({ from: owner });
    const initialBalance = await this.token.balanceOf(owner);
    await this.reservation.destroy({ from: owner });
    const finalBalance = await this.token.balanceOf(owner);
    finalBalance.should.be.bignumber.equal(initialBalance.add(EXPECTED_TOKEN_AMOUNT));
  });

});
