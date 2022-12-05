import {Address, BigInt} from '@graphprotocol/graph-ts'

export const ORACLE_ADDRESS = Address.fromString(
  '0xf0b7A1Bd858Cc8d6F09694D7cEf3b6a504f0804E'
)

export const getIdFromRoundAndAddress = (
  round: number,
  address: Address
): string => {
  return `${round}-${address.toHexString()}`
}

export const getIdFromRoundNameAndAddress = (
  name: string,
  round: number,
  address: Address
): string => {
  return `${name}-${round}-${address.toHexString()}`
}

export const getIdForNeuronPoolPrice = (
  address: Address,
  timestamp: BigInt
): string => {
  return `${address.toHexString()}-${timestamp.toString()}`
}
