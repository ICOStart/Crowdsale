function flatten_and_add_header([string]$filename)
{
  truffle-flattener .\contracts\$filename >.\flat\$filename
  $code = get-content .\flat\$filename
  $header = get-content .\ICOStartHeader.txt
  ($header + $code) | set-content .\flat\$filename
}

flatten_and_add_header ICOStartPromo.sol
flatten_and_add_header ICOStartSale.sol
flatten_and_add_header ICOStartToken.sol
flatten_and_add_header ICOStartReservation.sol
