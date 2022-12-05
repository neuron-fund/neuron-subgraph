import {Address, BigInt} from '@graphprotocol/graph-ts'
import {
  NextRoundParamsSelected,
  OpenShort,
  PremiumDistribute,
  PremiumForRound,
} from '../generated/NeuronThetaVault/NeuronThetaVault'
import {
  Deposit,
  InstantWithdraw,
  Withdraw,
  CloseShort,
  NeuronCollateralVault,
} from '../generated/NeuronCollateralVault/NeuronCollateralVault'
import {
  CollateralVault,
  CollateralVaultRoundAnalytic,
  CollateralVaultRoundPremium,
  NeuronPoolsPrice,
  VaultRoundAnalytic,
} from '../generated/schema'
import {ONToken} from '../generated/NeuronThetaVaultEthPut/ONToken'
import {Oracle} from '../generated/NeuronThetaVaultEthPut/Oracle'
import {INeuronPool} from '../generated/templates/NeuronCollateralVault/INeuronPool'

const ORACLE_ADDRESS = Address.fromString(
  '0xf0b7A1Bd858Cc8d6F09694D7cEf3b6a504f0804E'
)

const getIdFromRoundAndAddress = (round: number, address: Address): string => {
  return `${round}-${address.toHexString()}`
}

const getIdFromRoundNameAndAddress = (
  name: string,
  round: number,
  address: Address
): string => {
  return `${name}-${round}-${address.toHexString()}`
}

const getIdForNeuronPoolPrice = (
  address: Address,
  timestamp: BigInt
): string => {
  return `${address.toHexString()}-${timestamp.toString()}`
}

const createNeuronPoolPrice = (address: Address, timestamp: BigInt): string => {
  const oracle = Oracle.bind(ORACLE_ADDRESS)
  const price = oracle.getPrice(address)

  const id = getIdForNeuronPoolPrice(address, timestamp)
  const neuronPoolPrice = new NeuronPoolsPrice(id)
  neuronPoolPrice.address = address.toHexString()
  neuronPoolPrice.price = price
  neuronPoolPrice.timestamp = timestamp
  neuronPoolPrice.save()

  return id
}

export function handleNextRoundParamsSelected(
  event: NextRoundParamsSelected
): void {
  const round = event.params.nextRoundNumber
  const vaultAddress = event.address

  const id = getIdFromRoundAndAddress(round, vaultAddress)

  let vaultRoundAnalytic = VaultRoundAnalytic.load(id)

  if (vaultRoundAnalytic == null) {
    vaultRoundAnalytic = new VaultRoundAnalytic(id)
  }

  vaultRoundAnalytic.roundNumber = round
  vaultRoundAnalytic.vaultAddress = vaultAddress.toHexString()
  vaultRoundAnalytic.strike = event.params.strikePrice
  vaultRoundAnalytic.delta = event.params.delta
  vaultRoundAnalytic.premiumForEachOption = event.params.premiumForEachOption

  vaultRoundAnalytic.save()
}

export function handleOpenShort(event: OpenShort): void {
  const vaultAddress = event.address
  const lockedCollateralAmounts = event.params.lockedCollateralAmounts
  const totalLockedCollateralValue = event.params.totalLockedCollateralValue
  const optionAddress = event.params.optionAddress
  const optionMintedAmount = event.params.optionMintedAmount
  const collateralVaults = event.params.collateralVaults
  const roundNumber = event.params.roundNumber

  const blockTimestamp = event.block.timestamp

  const id = getIdFromRoundAndAddress(roundNumber, vaultAddress)

  const vaultRoundAnalytic = VaultRoundAnalytic.load(id)

  if (vaultRoundAnalytic == null) {
    throw new Error(`handleOpenShort: VaultRoundAnalytic not found for ${id}`)
  }

  const onToken = ONToken.bind(optionAddress)
  const optionExpiryTimestamp = onToken.expiryTimestamp()

  vaultRoundAnalytic.optionExpiryTimestamp = optionExpiryTimestamp
  vaultRoundAnalytic.optionAddress = optionAddress.toHexString()
  vaultRoundAnalytic.lockedAmounts = lockedCollateralAmounts
  vaultRoundAnalytic.lockedValue = totalLockedCollateralValue
  vaultRoundAnalytic.optionAddress = optionAddress.toHexString()
  vaultRoundAnalytic.optionsMinted = optionMintedAmount

  const collateralVaultsStrings: string[] = []

  for (let i = 0; i < collateralVaults.length; i++) {
    const collateralVault = NeuronCollateralVault.bind(collateralVaults[i])
    const collateralVaultNeuronPoolAddress = collateralVault.collateralToken()

    const neuronPoolPriceId = createNeuronPoolPrice(
      collateralVaultNeuronPoolAddress,
      blockTimestamp
    )

    vaultRoundAnalytic.neuronPoolsPricesRoundStart.push(neuronPoolPriceId)
    collateralVaultsStrings.push(collateralVaults[i].toHexString())
  }

  vaultRoundAnalytic.collateralVaults = collateralVaultsStrings

  vaultRoundAnalytic.save()
}

export function handlePremiumForRound(event: PremiumForRound): void {
  const vaultAddress = event.address
  const roundNumber = event.params.roundNumber

  // Return for first round
  if (roundNumber == 1) {
    return
  }

  const id = getIdFromRoundAndAddress(roundNumber, vaultAddress)

  const vaultRoundAnalytic = VaultRoundAnalytic.load(id)

  if (vaultRoundAnalytic == null) {
    throw new Error(
      `handlePremiumForRound: VaultRoundAnalytic not found for ${id}`
    )
  }

  vaultRoundAnalytic.premiumRecieved = event.params.premium

  vaultRoundAnalytic.save()
}

export function handlePremiumDistribute(event: PremiumDistribute): void {
  const vaultAddress = event.address
  const collateralVaultAddress = event.params.collateralVault
  const amount = event.params.amount
  const roundNumber = event.params.roundNumber

  // Return for first round
  if (roundNumber == 1) {
    return
  }

  const vaultRoundAnalyticId = getIdFromRoundAndAddress(
    roundNumber,
    vaultAddress
  )
  const vaultRoundAnalytic = VaultRoundAnalytic.load(vaultRoundAnalyticId)
  const blockTimestamp = event.block.timestamp

  if (vaultRoundAnalytic == null) {
    throw new Error(
      `handlePremiumForRound: VaultRoundAnalytic not found for ${vaultRoundAnalyticId}`
    )
  }
  const collateralVaults = vaultRoundAnalytic.collateralVaults

  for (let i = 0; i < collateralVaults.length; i++) {
    const collateralVault = NeuronCollateralVault.bind(
      Address.fromString(collateralVaults[i])
    )
    const collateralVaultNeuronPoolAddress = collateralVault.collateralToken()
    const neuronPoolPriceId = createNeuronPoolPrice(
      collateralVaultNeuronPoolAddress,
      blockTimestamp
    )

    vaultRoundAnalytic.neuronPoolsPricesRoundEnd.push(neuronPoolPriceId)
  }
  const collateralVaultRoundPremiumId = getIdFromRoundAndAddress(
    roundNumber,
    collateralVaultAddress
  )
  const collateralVaultRoundPremium = new CollateralVaultRoundPremium(
    collateralVaultRoundPremiumId
  )

  collateralVaultRoundPremium.vaultAddress = collateralVaultAddress.toHexString()
  collateralVaultRoundPremium.premium = amount
  collateralVaultRoundPremium.roundNumber = roundNumber

  collateralVaultRoundPremium.save()

  const premiumDistributed = vaultRoundAnalytic.premiumDistributed

  premiumDistributed.push(collateralVaultRoundPremiumId)

  vaultRoundAnalytic.premiumDistributed = premiumDistributed

  vaultRoundAnalytic.save()
}

export function handleCollateralVaultDeposit(event: Deposit): void {
  const collateralVaultAddress = event.address

  let collateralVaultEntity = CollateralVault.load(
    collateralVaultAddress.toHexString()
  )

  if (collateralVaultEntity == null) {
    collateralVaultEntity = new CollateralVault(
      collateralVaultAddress.toHexString()
    )
    collateralVaultEntity.address = collateralVaultAddress.toHexString()
    collateralVaultEntity.save()
  }

  const collateralVault = NeuronCollateralVault.bind(collateralVaultAddress)

  const totalBalance = collateralVault.totalBalance()

  collateralVaultEntity.tvl = totalBalance
  collateralVaultEntity.save()
}
export function handleCollateralVaultInstantWithdraw(
  event: InstantWithdraw
): void {
  const collateralVaultAddress = event.address

  let collateralVaultEntity = CollateralVault.load(
    collateralVaultAddress.toHexString()
  )

  if (collateralVaultEntity == null) {
    collateralVaultEntity = new CollateralVault(
      collateralVaultAddress.toHexString()
    )
    collateralVaultEntity.address = collateralVaultAddress.toHexString()
    collateralVaultEntity.save()
  }

  const collateralVault = NeuronCollateralVault.bind(collateralVaultAddress)

  const totalBalance = collateralVault.totalBalance()

  collateralVaultEntity.tvl = totalBalance
  collateralVaultEntity.save()
}
export function handleCollateralVaultWithdraw(event: Withdraw): void {
  const collateralVaultAddress = event.address

  let collateralVaultEntity = CollateralVault.load(
    collateralVaultAddress.toHexString()
  )

  if (collateralVaultEntity == null) {
    collateralVaultEntity = new CollateralVault(
      collateralVaultAddress.toHexString()
    )
    collateralVaultEntity.address = collateralVaultAddress.toHexString()
    collateralVaultEntity.save()
  }

  const collateralVault = NeuronCollateralVault.bind(collateralVaultAddress)

  const totalBalance = collateralVault.totalBalance()

  collateralVaultEntity.tvl = totalBalance
  collateralVaultEntity.save()
}
export function handleCollateralVaultCloseShort(event: CloseShort): void {
  const collateralVaultAddress = event.address
  const round = event.params.round
  const premium = event.params.premium

  const collateralVault = NeuronCollateralVault.bind(collateralVaultAddress)
  const neuronPoolAddress = collateralVault.collateralToken()
  const neuronPool = INeuronPool.bind(neuronPoolAddress)

  let collateralVaultEntity = CollateralVault.load(
    collateralVaultAddress.toHexString()
  )

  if (collateralVaultEntity == null) {
    collateralVaultEntity = new CollateralVault(
      collateralVaultAddress.toHexString()
    )
    collateralVaultEntity.address = collateralVaultAddress.toHexString()
    collateralVaultEntity.save()
  }

  const collateralVaultRoundAnalyticId = getIdFromRoundNameAndAddress(
    'collateralVaultRoundAnalytic',
    round,
    collateralVaultAddress
  )

  let collateralVaultRoundAnalyticEntity = CollateralVaultRoundAnalytic.load(
    collateralVaultRoundAnalyticId
  )

  if (collateralVaultRoundAnalyticEntity == null) {
    collateralVaultRoundAnalyticEntity = new CollateralVaultRoundAnalytic(
      collateralVaultRoundAnalyticId
    )
  }

  const totalBalance = collateralVault.totalBalance()
  const collateralVaultPricePerShare = collateralVault.pricePerShare()
  const neuronPoolPricePerShare = neuronPool.pricePerShare()

  collateralVaultEntity.tvl = totalBalance
  collateralVaultEntity.save()

  collateralVaultRoundAnalyticEntity.collateralVaultAddress = collateralVaultAddress.toHexString()
  collateralVaultRoundAnalyticEntity.roundNumber = round
  collateralVaultRoundAnalyticEntity.collateralVaultPricePerShare = collateralVaultPricePerShare
  collateralVaultRoundAnalyticEntity.neuronPoolPricePerShare = neuronPoolPricePerShare
  collateralVaultRoundAnalyticEntity.premiumRecieved = premium
  collateralVaultRoundAnalyticEntity.save()
}
