pragma solidity ^0.4.21;

// File: contracts\zeppelin-solidity\contracts\math\SafeMath.sol

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}

// File: contracts\zeppelin-solidity\contracts\token\ERC20\ERC20Basic.sol

/**
 * @title ERC20Basic
 * @dev Simpler version of ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/179
 */
contract ERC20Basic {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

// File: contracts\zeppelin-solidity\contracts\token\ERC20\ERC20.sol

/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender) public view returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: contracts\zeppelin-solidity\contracts\crowdsale\Crowdsale.sol

/**
 * @title Crowdsale
 * @dev Crowdsale is a base contract for managing a token crowdsale,
 * allowing investors to purchase tokens with ether. This contract implements
 * such functionality in its most fundamental form and can be extended to provide additional
 * functionality and/or custom behavior.
 * The external interface represents the basic interface for purchasing tokens, and conform
 * the base architecture for crowdsales. They are *not* intended to be modified / overriden.
 * The internal interface conforms the extensible and modifiable surface of crowdsales. Override 
 * the methods to add functionality. Consider using 'super' where appropiate to concatenate
 * behavior.
 */

contract Crowdsale {
  using SafeMath for uint256;

  // The token being sold
  ERC20 public token;

  // Address where funds are collected
  address public wallet;

  // How many token units a buyer gets per wei
  //uint256 public rate;

  // Amount of wei raised
  uint256 public weiRaised;

  /**
   * Event for token purchase logging
   * @param purchaser who paid for the tokens
   * @param beneficiary who got the tokens
   * @param value weis paid for purchase
   * @param amount amount of tokens purchased
   */
  event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

  /**
   * @param _wallet Address where collected funds will be forwarded to
   * @param _token Address of the token being sold
   */
  function Crowdsale(/*uint256 _rate, */address _wallet, ERC20 _token) public {
    //require(_rate > 0);
    require(_wallet != address(0));
    require(_token != address(0));

    //rate = _rate;
    wallet = _wallet;
    token = _token;
  }

  // -----------------------------------------
  // Crowdsale external interface
  // -----------------------------------------

  /**
   * @dev fallback function ***DO NOT OVERRIDE***
   */
  function () external payable {
    buyTokens(msg.sender);
  }

  /**
   * @dev low level token purchase ***DO NOT OVERRIDE***
   * @param _beneficiary Address performing the token purchase
   */
  function buyTokens(address _beneficiary) public payable {

    uint256 weiAmount = msg.value;
    _preValidatePurchase(_beneficiary, weiAmount);

    // calculate token amount to be created
    uint256 tokens = _getTokenAmount(weiAmount);

    // update state
    weiRaised = weiRaised.add(weiAmount);

    _processPurchase(_beneficiary, tokens);
    emit TokenPurchase(msg.sender, _beneficiary, weiAmount, tokens);

    _updatePurchasingState(_beneficiary, weiAmount);

    _forwardFunds();
    _postValidatePurchase(_beneficiary, weiAmount);
  }

  // -----------------------------------------
  // Internal interface (extensible)
  // -----------------------------------------

  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met. Use super to concatenate validations.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    require(_beneficiary != address(0));
    require(_weiAmount != 0);
  }

  /**
   * @dev Validation of an executed purchase. Observe state and use revert statements to undo rollback when valid conditions are not met.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _postValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    // optional override
  }

  /**
   * @dev Source of tokens. Override this method to modify the way in which the crowdsale ultimately gets and sends its tokens.
   * @param _beneficiary Address performing the token purchase
   * @param _tokenAmount Number of tokens to be emitted
   */
  function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
    token.transfer(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Executed when a purchase has been validated and is ready to be executed. Not necessarily emits/sends tokens.
   * @param _beneficiary Address receiving the tokens
   * @param _tokenAmount Number of tokens to be purchased
   */
  function _processPurchase(address _beneficiary, uint256 _tokenAmount) internal {
    _deliverTokens(_beneficiary, _tokenAmount);
  }

  /**
   * @dev Override for extensions that require an internal state to check for validity (current user contributions, etc.)
   * @param _beneficiary Address receiving the tokens
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _updatePurchasingState(address _beneficiary, uint256 _weiAmount) internal {
    // optional override
  }

  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @param _weiAmount Value in wei to be converted into tokens
   * @return Number of tokens that can be purchased with the specified _weiAmount
   */
  function _getTokenAmount(uint256 _weiAmount) internal view returns (uint256) {
    // override
    //return _weiAmount.mul(rate);
  }

  /**
   * @dev Determines how ETH is stored/forwarded on purchases.
   */
  function _forwardFunds() internal {
    wallet.transfer(msg.value);
  }
}

// File: contracts\zeppelin-solidity\contracts\crowdsale\emission\AllowanceCrowdsale.sol

/**
 * @title AllowanceCrowdsale
 * @dev Extension of Crowdsale where tokens are held by a wallet, which approves an allowance to the crowdsale.
 */
contract AllowanceCrowdsale is Crowdsale {
  using SafeMath for uint256;

  address public tokenWallet;

  /**
   * @dev Constructor, takes token wallet address. 
   * @param _tokenWallet Address holding the tokens, which has approved allowance to the crowdsale
   */
  function AllowanceCrowdsale(address _tokenWallet) public {
    require(_tokenWallet != address(0));
    tokenWallet = _tokenWallet;
  }

  /**
   * @dev Checks the amount of tokens left in the allowance.
   * @return Amount of tokens left in the allowance
   */
  function remainingTokens() public view returns (uint256) {
    return token.allowance(tokenWallet, this);
  }

  /**
   * @dev Overrides parent behavior by transferring tokens from wallet.
   * @param _beneficiary Token purchaser
   * @param _tokenAmount Amount of tokens purchased
   */
  function _deliverTokens(address _beneficiary, uint256 _tokenAmount) internal {
    token.transferFrom(tokenWallet, _beneficiary, _tokenAmount);
  }
}

// File: contracts\zeppelin-solidity\contracts\ownership\Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() public {
    owner = msg.sender;
  }

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }

  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    emit OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}

// File: contracts\zeppelin-solidity\contracts\lifecycle\Pausable.sol

/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract Pausable is Ownable {
  event Pause();
  event Unpause();

  bool public paused = false;


  /**
   * @dev Modifier to make a function callable only when the contract is not paused.
   */
  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is paused.
   */
  modifier whenPaused() {
    require(paused);
    _;
  }

  /**
   * @dev called by the owner to pause, triggers stopped state
   */
  function pause() onlyOwner whenNotPaused public {
    paused = true;
    emit Pause();
  }

  /**
   * @dev called by the owner to unpause, returns to normal state
   */
  function unpause() onlyOwner whenPaused public {
    paused = false;
    emit Unpause();
  }
}

// File: contracts\ICOStartSale.sol

contract ICOStartSale is
  AllowanceCrowdsale,
  Pausable {

  struct Period {
    uint256 startTimestamp;
    uint256 endTimestamp;
    uint256 rate;
  }

  Period[] private periods;
  mapping(address => bool) public whitelistedAddresses;
  mapping(address => uint256) public whitelistedRates;

  uint256 constant public MINIMUM_AMOUNT = 0.05 ether;
  uint256 constant public MAXIMUM_NON_WHITELIST_AMOUNT = 5 ether;

  /**
   * @dev Constructor, takes initial parameters.
   * @param _wallet Address where collected funds will be forwarded to.
   * @param _token Address of the token being sold.
   * @param _tokenWallet Address holding the tokens, which has approved allowance to this contract.
   */
  function ICOStartSale(address _wallet, ERC20 _token, address _tokenWallet) public
    Crowdsale(_wallet, _token)
    AllowanceCrowdsale(_tokenWallet)
  {
  }

  /**
   * @dev Add a sale period with its default rate.
   * @param _startTimestamp Beginning of this sale period.
   * @param _endTimestamp End of this sale period.
   * @param _rate Rate at which tokens are sold during this sale period.
   */
  function addPeriod(uint256 _startTimestamp, uint256 _endTimestamp, uint256 _rate) onlyOwner public {
    require(_startTimestamp != 0);
    require(_endTimestamp > _startTimestamp);
    require(_rate != 0);
    Period memory period = Period(_startTimestamp, _endTimestamp, _rate);
    periods.push(period);
  }

  /**
   * @dev Emergency function to clear all sale periods (for example in case the sale is delayed).
   */
  function clearPeriods() onlyOwner public {
    delete periods;
  }

  /**
   * @dev Add an address to the whitelist or update the rate of an already added address.
   * This function cannot be used to reset a previously set custom rate. Remove the address and add it
   * again if you need to do that.
   * @param _address Address to whitelist
   * @param _rate Optional custom rate reserved for that address (0 = use default rate)
   * @return true if the address was added to the whitelist, false if the address was already in the whitelist
   */
  function addAddressToWhitelist(address _address, uint256 _rate) onlyOwner public returns (bool success) {
    require(_address != address(0));
    success = false;
    if (!whitelistedAddresses[_address]) {
      whitelistedAddresses[_address] = true;
      success = true;
    }
    if (_rate != 0) {
      whitelistedRates[_address] = _rate;
    }
  }

  /**
   * @dev Adds an array of addresses to the whitelist, all with the same optional custom rate.
   * @param _addresses Addresses to add.
   * @param _rate Optional custom rate reserved for all added addresses (0 = use default rate).
   * @return true if at least one address was added to the whitelist,
   * false if all addresses were already in the whitelist  
   */
  function addAddressesToWhitelist(address[] _addresses, uint256 _rate) onlyOwner public returns (bool success) {
    success = false;
    for (uint256 i = 0; i <_addresses.length; i++) {
      if (addAddressToWhitelist(_addresses[i], _rate)) {
        success = true;
      }
    }
  }

  /**
   * @dev Remove an address from the whitelist.
   * @param _address Address to remove.
   * @return true if the address was removed from the whitelist, 
   * false if the address wasn't in the whitelist in the first place.
   */
  function removeAddressFromWhitelist(address _address) onlyOwner public returns (bool success) {
    require(_address != address(0));
    success = false;
    if (whitelistedAddresses[_address]) {
      whitelistedAddresses[_address] = false;
      success = true;
    }
    if (whitelistedRates[_address] != 0) {
      whitelistedRates[_address] = 0;
    }
  }

  /**
   * @dev Remove addresses from the whitelist.
   * @param _addresses addresses
   * @return true if at least one address was removed from the whitelist, 
   * false if all addresses weren't in the whitelist in the first place
   */
  function removeAddressesFromWhitelist(address[] _addresses) onlyOwner public returns (bool success) {
    success = false;
    for (uint256 i = 0; i < _addresses.length; i++) {
      if (removeAddressFromWhitelist(_addresses[i])) {
        success = true;
      }
    }
  }

  /**
   * @dev True if the specified address is whitelisted.
   */
  function isAddressInWhitelist(address _address) view public returns (bool) {
    return whitelistedAddresses[_address];
  }

  /**
   * @dev True while the sale is open (i.e. accepting contributions). False otherwise.
   */
  function isOpen() view public returns (bool) {
    return ((!paused) && (_getCurrentPeriod().rate != 0));
  }

  /*
   * Internal functions
   */

  /**
   * @dev Returns the current period, or null.
   */
  function _getCurrentPeriod() view internal returns (Period memory _period) {
    _period = Period(0, 0, 0);
    for (uint256 i = 0; i < periods.length; i++) {
      if ((periods[i].startTimestamp <= block.timestamp) && (periods[i].endTimestamp >= block.timestamp)) {
        _period = periods[i];
        break;
      }
    }
  }

  /**
   * @dev Validation of an incoming purchase. Use require statements to revert state when conditions are not met. Use super to concatenate validations.
   * @param _beneficiary Address performing the token purchase
   * @param _weiAmount Value in wei involved in the purchase
   */
  function _preValidatePurchase(address _beneficiary, uint256 _weiAmount) internal {
    super._preValidatePurchase(_beneficiary, _weiAmount);
    
    require(_weiAmount >= MINIMUM_AMOUNT);
    require(isOpen());
    if (_weiAmount > MAXIMUM_NON_WHITELIST_AMOUNT) {
      if (!isAddressInWhitelist(_beneficiary)) {
        revert();
      }
    }
  }

  /**
   * @dev Override to extend the way in which ether is converted to tokens.
   * @param _weiAmount Value in wei to be converted into tokens
   * @return Number of tokens that can be purchased with the specified _weiAmount
   */
  function _getTokenAmount(address _beneficiary, uint256 _weiAmount) internal view returns (uint256) {
    Period memory currentPeriod = _getCurrentPeriod();
    require(currentPeriod.rate != 0);
    uint256 rate = whitelistedRates[_beneficiary];
    if (rate == 0) {
      rate = currentPeriod.rate;
    }
    return _weiAmount.mul(rate);
  }
}

// File: contracts\ICOStartReservation.sol

contract ICOStartReservation is Pausable {
  using SafeMath for uint256;

  ICOStartSale public sale;
  uint256 public cap;
  uint8 public feePerc;
  address public manager;
  mapping(address => uint256) public deposits;
  uint256 public weiCollected;
  uint256 public tokensReceived;
  bool public canceled;
  bool public paid;

  event Deposited(address indexed depositor, uint256 amount);
  event Withdrawn(address indexed beneficiary, uint256 amount);
  event Paid(uint256 netAmount, uint256 fee);
  event Canceled();

  function ICOStartReservation(ICOStartSale _sale, uint256 _cap, uint8 _feePerc, address _manager) public {
    require(_sale != (address(0)));
    require(_cap != 0);
    require(_feePerc >= 0);

    sale = _sale;
    cap = _cap;
    feePerc = _feePerc;
    manager = _manager;
  }

  /**
   * @dev Modifier to make a function callable only when the contract is accepting
   * deposits.
   */
  modifier whenOpen() {
    require(isOpen());
    _;
  }

  /**
   * @dev Modifier to make a function callable only if the reservation was not canceled.
   */
  modifier whenNotCanceled() {
    require(!canceled);
    _;
  }

  /**
   * @dev Modifier to make a function callable only if the reservation was canceled.
   */
  modifier whenCanceled() {
    require(canceled);
    _;
  }

  /**
   * @dev Modifier to make a function callable only if the reservation was not yet paid.
   */
  modifier whenNotPaid() {
    require(!paid);
    _;
  }

  /**
   * @dev Modifier to make a function callable only if the reservation was paid.
   */
  modifier whenPaid() {
    require(paid);
    _;
  }

  /**
   * @dev Checks whether the cap has been reached. 
   * @return Whether the cap was reached
   */
  function capReached() public view returns (bool) {
    return weiCollected >= cap;
  }

  /**
   * @dev Checks whether the cap has been reached. 
   * @return Whether the cap was reached
   */
  function getToken() public view returns (ERC20) {
    return sale.token();
  }

  /**
   * @dev Modifier to make a function callable only when the contract is accepting
   * deposits.
   */
  function isOpen() public view returns (bool) {
    return !paused && !capReached() && !canceled && !paid;
  }

  /**
   * @dev Shortcut for deposit() and claimTokens() functions.
   * Send 0 to claim, any other value to deposit.
   */
  function () external payable {
    if (msg.value == 0) {
      claimTokens(msg.sender);
    } else {
      deposit(msg.sender);
    }
  }

  /**
   * @dev Deposit ethers in the contract keeping track of the sender.
   * @param _depositor Address performing the purchase
   */
  function deposit(address _depositor) public whenOpen payable {
    require(_depositor != address(0));
    require(weiCollected.add(msg.value) <= cap);
    deposits[_depositor] = deposits[_depositor].add(msg.value);
    weiCollected = weiCollected.add(msg.value);
    emit Deposited(_depositor, msg.value);
  }

  /**
   * @dev Allows the owner to cancel the reservation thus enabling withdraws.
   * Contract must first be paused so we are sure we are not accepting deposits.
   */
  function cancel() public onlyOwner whenPaused whenNotPaid {
    canceled = true;
  }

  /**
   * @dev Allows the owner to cancel the reservation thus enabling withdraws.
   * Contract must first be paused so we are sure we are not accepting deposits.
   */
  function pay() public onlyOwner whenNotCanceled {
    require(weiCollected > 0);
  
    uint256 fee;
    uint256 netAmount;
    (fee, netAmount) = _getFeeAndNetAmount(weiCollected);

    sale.buyTokens.value(netAmount)(this);
    tokensReceived = sale.token().balanceOf(this);

    if (fee != 0) {
      manager.transfer(fee);
    }

    paid = true;
    emit Paid(netAmount, fee);
  }

  /**
   * @dev Allows a depositor to withdraw his contribution if the reservation was canceled.
   */
  function withdraw() public whenCanceled {
    uint256 depositAmount = deposits[msg.sender];
    require(depositAmount != 0);
    deposits[msg.sender] = 0;
    weiCollected = weiCollected.sub(depositAmount);
    msg.sender.transfer(depositAmount);
    emit Withdrawn(msg.sender, depositAmount);
  }

  /**
   * @dev After the reservation is paid, transfers tokens from the contract to the
   * specified address (which must have deposited ethers earlier).
   * @param _beneficiary Address that will receive the tokens.
   */
  function claimTokens(address _beneficiary) public whenPaid {
    require(_beneficiary != address(0));
    
    uint256 depositAmount = deposits[_beneficiary];
    if (depositAmount != 0) {
      uint256 tokens = tokensReceived.mul(depositAmount).div(weiCollected);
      assert(tokens != 0);
      deposits[_beneficiary] = 0;
      sale.token().transfer(_beneficiary, tokens);
    }
  }

  /**
   * @dev Emergency brake. Send all ethers and tokens to the owner.
   */
  function destroy() onlyOwner public {
    uint256 myTokens = sale.token().balanceOf(this);
    if (myTokens != 0) {
      sale.token().transfer(owner, myTokens);
    }
    selfdestruct(owner);
  }

  /*
   * Internal functions
   */

  /**
   * @dev Returns the current period, or null.
   */
   function _getFeeAndNetAmount(uint256 _grossAmount) internal view returns (uint256 _fee, uint256 _netAmount) {
      _fee = _grossAmount.div(100).mul(feePerc);
      _netAmount = _grossAmount.sub(_fee);
   }
}
