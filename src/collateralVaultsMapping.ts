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
} from '../generated/schema'
import {INeuronPool} from '../generated/templates/NeuronCollateralVault/INeuronPool'
import {getIdFromRoundNameAndAddress} from './utils'

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
