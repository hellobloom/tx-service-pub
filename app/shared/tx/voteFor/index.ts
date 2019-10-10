import {loadPoll} from '@shared/contracts/load'
import {TransactionOptions} from '@shared/contracts/truffle'
import {trySendTx} from '@shared/tryTx'
import {getManager} from '@shared/manager'
import {IVoteForParams} from '@shared/tx/voteFor/validate'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {EContractNames as E} from '@shared/tx/method_manifest'
import {TWrappedBlockchainTransaction} from '@shared/Ethereum'

export const voteFor: TWrappedBlockchainTransaction = async (
  txOptions: TransactionOptions,
  args: IVoteForParams,
  network: ENetworks
) => {
  const Poll = loadPoll(args.pollAddress)

  const admin = await getManager(E.Poll, network)

  return admin.withWeb3(async web3 => {
    const poll = Poll.withProvider(web3.currentProvider)

    return await trySendTx(poll.voteFor, 'voteFor', txOptions, [
      args.choice,
      args.voter,
      args.nonce,
      args.delegationSig,
    ])
  })
}
