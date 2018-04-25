pragma solidity ^0.4.21;

import "zeppelin-solidity/contracts/ownership/Whitelist.sol";

/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract LockableWhitelisted is Whitelist {
  event Locked();
  event Unlocked();

  bool public locked = false;


  /**
   * @dev Modifier to make a function callable only when the contract is not locked
   * or the caller is whitelisted.
   */
  modifier whenNotLocked() {
    require(!locked || whitelist[msg.sender]);
    _;
  }

  /**
   * @dev Returns true if the specified address is whitelisted.
   * @param _address The address to check for whitelisting status.
   */
  function isWhitelisted(address _address) public view returns (bool) {
    return whitelist[_address];
  }

  /**
   * @dev called by the owner to lock, triggers locked state
   */
  function lock() onlyOwner whenNotLocked public {
    locked = true;
    emit Locked();
  }

  /**
   * @dev called by the owner to unlock, returns to normal state
   */
  function unlock() onlyOwner public {
    if (locked) {
      locked = false;
      emit Unlocked();
    }
  }
}
