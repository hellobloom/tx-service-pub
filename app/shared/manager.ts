import * as Web3 from 'web3'
import {withPrivateEngine, walletFor} from '@shared/ethereum/customWeb3Provider'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {EContractNames} from '@shared/tx/method_manifest'
import {keyByContractAndNetwork} from '@shared/ethereum/account'
import {TBlockchainTransactionOutcome} from '@shared/Ethereum'

export const getManager = async (
  contractName: EContractNames,
  network: ENetworks
) => {
  const privateKey = await keyByContractAndNetwork(contractName, network)
  const wallet = walletFor(privateKey)
  return {
    wallet: wallet,
    address: wallet.getAddressString(),
    withWeb3: async (
      callback: (web3: Web3) => Promise<TBlockchainTransactionOutcome>
    ) => {
      return withPrivateEngine(privateKey, {stage: network}, async engine => {
        return callback(new Web3(engine))
      })
    },
  }
}
