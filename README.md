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
- The owner is automatically whitelisted. Transfering ownership also adds the new owner to the whitelist (and removes the former owner).
- Tokens can be burned by their owner through a function of the token contract which will destroy them and reduce the total supply accordingly.
- The contract features airdrop() and multiTransfer() functions to allow for multiple transfers in the same transactions (limited to 200 each time to prevent gas exhaustion).

Sale contract:

- Is created with a given amount of tokens to sell, a start/end sale timestamp, a base price for the tokens, an address (which is going to represent a hardware or other cold wallet) to which received funds are transfered, a reference to the token contract as parameters.
- Has a whitelist of addresses that can contribute. Some whitelisted addresses might receive bonus tokens. The owner can add and remove whitelisted addresses (either single addresses or batches) and set specific bonus percentages.
- Accepts ethers and distributes tokens immediately according to the set price and bonus.
- Is deployed in two (or possibly more) instances, one for the presale and one for the sale.
- The owner can close the sale ahead of time and withdraw unsold tokens (which can then be burned through the token contract).

Reservation contract:

- Is created with a cap, a manager's fee %, a reference to a sale contract as parameters.
- Receives ethers up to a given cap (specified on creation) and keeps track of contributing addresses.
- Does *not* support whitelisting. Everyone can send up to the cap when the contract is enabled.
- Can be paused/restarted by the owner. When paused, does not accept contributions.
- Has a function that allows the owner to send all ethers (minus the pool manager's fee) to the specified crowdsale contract thus collecting the tokens. The reservation contract's address must have been whitelisted in the sale contract and the sale must be ongoing for this to succeed. All ethers are transfered minus the manager's fee which is sent to the caller (also the contract's owner).
- A *separate* owner-callable function will distribute the received tokens to the contributing addresses. Since this is an O(n) function, caution must be excercised re. gas consumption.
- Can be destroyed by the ower (which will collect any residual balance in case something unexpected has occurred).

[icostartsite]: https://icostart.ch
[solidity]: https://solidity.readthedocs.io/en/develop/
[openzeppelin]: https://openzeppelin.org/
[truffle]: http://truffleframework.com/
[ganache]: http://truffleframework.com/ganache/
