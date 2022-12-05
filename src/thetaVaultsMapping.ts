import {Address, BigInt} from '@graphprotocol/graph-ts'
import {
  NextRoundParamsSelected,
  OpenShort,
  PremiumDistribute,
  PremiumForRound,
} from '../generated/NeuronThetaVault/NeuronThetaVault'
import {NeuronCollateralVault} from '../generated/NeuronCollateralVault/NeuronCollateralVault'
import {
  CollateralVaultRoundPremium,
  NeuronPoolsPrice,
  VaultRoundAnalytic,
} from '../generated/schema'
import {ONToken} from '../generated/NeuronThetaVaultEthPut/ONToken'
import {Oracle} from '../generated/NeuronThetaVaultEthPut/Oracle'
import {
  getIdForNeuronPoolPrice,
  getIdFromRoundAndAddress,
  ORACLE_ADDRESS,
} from './utils'

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
