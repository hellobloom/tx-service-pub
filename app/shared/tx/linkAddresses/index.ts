import {loadAccountRegistryLogic} from '@shared/contracts/load'
import {TransactionOptions} from '@shared/contracts/truffle'
import {trySendTx} from '@shared/tryTx'
import {TWrappedBlockchainTransaction} from '@shared/Ethereum'
import {getManager} from '@shared/manager'
import {IAddAddressParams} from '@shared/tx/linkAddresses/validate'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {EContractNames as E} from '@shared/tx/method_manifest'
import {getContractAddr} from '@shared/environment'

export const linkAddresses: TWrappedBlockchainTransaction = async (
  txOptions: TransactionOptions,
  addAddressParams: IAddAddressParams,
  network: ENetworks
) => {
  const admin = await getManager(E.AccountRegistryLogic, network)
  const AccountRegistryLogic = loadAccountRegistryLogic(
    await getContractAddr('AccountRegistryLogic', network)
  )

  return admin.withWeb3(async web3 => {
    const registryLogic = AccountRegistryLogic.withProvider(web3.currentProvider)

    txOptions.gas = 1000000
    return await trySendTx(registryLogic.linkAddresses, 'linkAddresses', txOptions, [
      addAddressParams.sender,
      addAddressParams.senderSig,
      addAddressParams.newAddress,
      addAddressParams.newAddressSig,
      addAddressParams.nonce,
    ])
  })
}
