import {loadAttestationLogic} from '@shared/contracts/load'
import {trySendTx} from '@shared/tryTx'
import {TWrappedBlockchainTransaction} from '@shared/Ethereum'

import {IAttestForParams} from '@shared/tx/attestFor/validate'
import {getManager} from '@shared/manager'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {EContractNames as E} from '@shared/tx/method_manifest'
import {getContractAddr} from '@shared/environment'
import {TransactionOptions} from '@shared/contracts/truffle'

export const attestFor: TWrappedBlockchainTransaction = async (
  txOptions: TransactionOptions,
  args: IAttestForParams,
  network: ENetworks
) => {
  const admin = await getManager(E.AttestationLogic, network)
  const AttestationLogic = loadAttestationLogic(
    await getContractAddr('AttestationLogic', network)
  )

  txOptions.gas = 500000

  return admin.withWeb3(async web3 => {
    const attestationLogic = AttestationLogic.withProvider(web3.currentProvider)

    return await trySendTx(attestationLogic.attestFor, 'attestFor', txOptions, [
      args.subject,
      args.attester,
      args.requester,
      args.reward,
      args.requesterSig,
      args.dataHash,
      args.requestNonce,
      args.subjectSig,
      args.delegationSig,
    ])
  })
}
