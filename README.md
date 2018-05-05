# ICOStart Presale, Sale and Token contracts

This repository contains the contracts for the [icostart.ch][icostartsite] token sales.

![ICOStart logo](icostart_logo.png)

## Contracts

Please see the [contracts/](contracts) directory.

## Development environment

Contracts are written in [Solidity][solidity] based on the [OpenZeppelin][openzeppelin] framework and tested using [Truffle][truffle] and [Ganache][ganache].

### Dependencies

```
# Install Truffle globally:
npm install -g truffle

# Install local node dependencies:
npm install

# Install Ganache following the instructions for your platform.
```

### Test

```
# Start Ganache on your platform.

# Compile and test the contracts
truffle test
```

### Contract behaviour

Token contract:

- The token contract mints a total supply of 60.000.000 ICH ERC20 tokens and disburses them to the address specified upon creation.
- The tokens are born non-transferable and can be made transferable later by the contract owner.
- Some owner-defined addresses *can* transfer the tokens even while they are locked. The sale and reservation contracts need to do that.
- The owner is automatically whitelisted. Transfering ownership also adds the new owner to the whitelist (and removes the former owner from it).
- Tokens can be burned by their holder through a function of the token contract which will destroy them and reduce the total supply accordingly.
- The contract features airdrop() and multiTransfer() functions to allow for multiple transfers in the same transaction (limited to 200 each time in order to prevent gas exhaustion).

Sale contract:

- Is created with a given (maximum) amount of tokens to sell, an address (which is going to represent a hardware or other cold wallet) to which received funds are transfered, and a reference to the token contract as parameters.
- After creation, the owner configures one or more sale periods, each of which consists of a start/end timestamp range and a price (expressed as a rate) for the tokens sold in that period.
- The sale will only accept contributions if at least one period is defined, and only inside periods (not before the beginning of the first one, not after the end of the last one).
- Has a whitelist of addresses that can contribute. Some whitelisted addresses can have a custom rate set so that they can receive bonus tokens. The owner can add and remove whitelisted addresses (either single addresses or batches) and set a specific custom rate for each one (which, if set, will override the default rate of the period that is current at the time of payment for that specific contributing address; this allows reservation contracts with fixed - possibly discounted - rates).
- Accepts ethers and distributes tokens immediately according to the current rate determined for the sender.
- Rejects transactions under 0.05 ethers.
- Accepts transactions lower than or equal to 5 ethers even from non-whitelisted senders.
- Is deployed in two (or possibly more) instances, one for the presale and one for the sale.
- The owner can close the sale ahead of time and withdraw unsold tokens (which can then be burned through the token contract).
- Doesn't have a hard cap: the sale stops at the end of the last period, or when all allowed tokens have been sold, or when the owner stops it.
- Doesn't have any minimum goal or automatic refund mechanism.

Reservation contract:

- Is created with a hard cap (in ethers), a manager's fee % and address, and a reference to a sale contract as parameters.
- Receives ethers up to a given cap (specified on creation) and keeps track of contributing addresses.
- Does *not* support whitelisting. Everyone can send up to the cap when the contract is enabled.
- Can be paused/restarted by the owner. When paused, does not accept contributions.
- Has a function that allows the owner to send all ethers (minus the pool manager's fee) to the specified crowdsale contract thus collecting the tokens. The reservation contract's address must have been whitelisted in the sale contract and the sale must be accepting contributions for this to succeed. All ethers are transfered, minus the manager's fee (if any) which is sent to the manager's address. All tokens are stored in the contract and can be claimed.
- Has a separate owner-callable function that will cancel the resrvation and enable refunds.
- Has a withdraw function that any contributor can call to get his contribution back if the reservation was canceled.
- Has a claim function that any contributor can call to get his tokens (tokens must be unlocked, or the reservation contract must
be whitelisted in the token contract for this to succeed).
- Can be destroyed by the ower (which will collect any residual balance of both ethers and tokens in case something unexpected has occurred).

Promo contract:

An additional pseudo-token contract is created as a promotional tool. This contract:

- Displays the same balance for any address.
- Allows all ERC-20 operations but they have no effect.
- Has a name, an url and a symbol (all can be set by the owner). The url point to a landing page possibly offering a discounted rate to anyone willing to participate in the ICO.
- Supports an airdrop function that simulates Transfer events in order to have the virtual balance displayed in wallets that track these events.
- Does not accept receiving ethers.
- Can be destroyed by the owner.

[icostartsite]: https://icostart.ch
[solidity]: https://solidity.readthedocs.io/en/develop/
[openzeppelin]: https://openzeppelin.org/
[truffle]: http://truffleframework.com/
[ganache]: http://truffleframework.com/ganache/
