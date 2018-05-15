pragma solidity ^0.4.21;

import "./zeppelin-solidity/contracts/ownership/Whitelist.sol";

/**
 * @dev A Whitelist contract that can be locked and unlocked. Provides a modifier
 * to check for locked state plus functions and events. The contract is never locked for
 * whitelisted addresses. The contracts starts off unlocked and can be locked and
 * then unlocked a single time. Once unlocked, the contract can never be locked back.
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract LockableWhitelisted is Whitelist {
  event Locked();
  event Unlocked();

  bool public locked = false;
  bool private unlockedOnce = false;

  /**
   * @dev Modifier to make a function callable only when the contract is not locked
   * or the caller is whitelisted.
   */
  modifier whenNotLocked(address _address) {
    require(!locked || whitelist[_address]);
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
   * @dev Called by the owner to lock.
   */
  function lock() onlyOwner public {
    require(!unlockedOnce);
    if (!locked) {
      locked = true;
      emit Locked();
    }
  }

  /**
   * @dev Called by the owner to unlock.
   */
  function unlock() onlyOwner public {
    if (locked) {
      locked = false;
      unlockedOnce = true;
      emit Unlocked();
    }
  }
}
