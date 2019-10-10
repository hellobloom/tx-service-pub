import {loadAccountRegistryLogic} from '@shared/contracts/load'
import {TransactionOptions} from '@shared/contracts/truffle'
import {trySendTx} from '@shared/tryTx'
import {getManager} from '@shared/manager'
import {IUnlinkAddressParams} from '@shared/tx/unlinkAddress/validate'
import {EContractNames as E} from '@shared/tx/method_manifest'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {getContractAddr} from '@shared/environment'
import {TWrappedBlockchainTransaction} from '@shared/Ethereum'

export const unlinkAddress: TWrappedBlockchainTransaction = async (
  txOptions: TransactionOptions,
  args: IUnlinkAddressParams,
  network: ENetworks
) => {
  const admin = await getManager(E.AccountRegistryLogic, network)
  const AccountRegistryLogic = loadAccountRegistryLogic(
    await getContractAddr('AccountRegistryLogic', network)
  )

  return admin.withWeb3(async web3 => {
    const registryLogic = AccountRegistryLogic.withProvider(web3.currentProvider)

    txOptions.gas = 300000
    return await trySendTx(registryLogic.unlinkAddress, 'unlinkAddress', txOptions, [
      args.addressToRemove,
      args.nonce,
      args.unlinkSig,
    ])
  })
}
