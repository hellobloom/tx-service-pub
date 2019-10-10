import {loadBatchAttestationLogic} from '@shared/contracts/load'
import {trySendTx} from '@shared/tryTx'
import {TWrappedBlockchainTransaction} from '@shared/Ethereum'

import {IBatchAttestParams} from '@shared/tx/batchAttest/validate'
import {getManager} from '@shared/manager'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {EContractNames as E} from '@shared/tx/method_manifest'
import {getContractAddr} from '@shared/environment'
import {TransactionOptions} from '@shared/contracts/truffle'

export const batchAttest: TWrappedBlockchainTransaction = async (
  txOptions: TransactionOptions,
  args: IBatchAttestParams,
  network: ENetworks
) => {
  const admin = await getManager(E.AttestationLogic, network)
  const BatchAttestationLogic = loadBatchAttestationLogic(
    await getContractAddr('BatchAttestationLogic', network)
  )

  txOptions.gas = 500000

  return admin.withWeb3(async web3 => {
    const batchAttestationLogic = BatchAttestationLogic.withProvider(
      web3.currentProvider
    )

    return await trySendTx(
      batchAttestationLogic.batchAttest,
      'batchAttest',
      txOptions,
      [args.dataHash]
    )
  })
}
