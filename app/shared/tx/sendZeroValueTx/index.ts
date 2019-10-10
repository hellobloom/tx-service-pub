import {TransactionOptions} from '@shared/contracts/truffle'
import {getManager} from '@shared/manager'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {EContractNames} from '@shared/tx/method_manifest'
import {TBlockchainTransactionOutcome} from '@shared/Ethereum'
import {log} from '@shared/logger'
import {promisify} from 'bluebird'
import {TtxJobFn} from '@shared/tryTx'

export const sendZeroValueTx: TtxJobFn = async (
  contract: EContractNames,
  txOptions: TransactionOptions,
  network: ENetworks
) => {
  const admin = await getManager(contract, network)
  return admin.withWeb3(async web3 => {
    let result: TBlockchainTransactionOutcome
    try {
      const txHash = await promisify(web3.eth.sendTransaction)(
        Object.assign(txOptions, {
          from: admin.address,
          to: admin.address,
          value: 0,
          gas: 30000,
        })
      )
      result = {
        kind: 'success',
        txHash: txHash,
      }
    } catch (err) {
      log(
        `
          Failed to execute sendZeroValueTx
          Error: ${err.message}
          `,
        {level: 'warn'}
      )
      result = {
        kind: 'invalid_transaction',
        message: `failed to execute sendZeroValueTx`,
      }
    }
    return result
  })
}
