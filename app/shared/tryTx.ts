import {env} from '@shared/environment'
import {GasPrice, MaxNonce, Tx, TxAttempt} from '@shared/models'
import {BigNumber} from 'bignumber.js'
import {TransactionOptions} from '@shared/contracts/truffle'
import {
  withReadOnlyEngine,
  IWithPrivateEngineResult,
} from '@shared/ethereum/customWeb3Provider'
import {
  // TBlockchainTransaction,
  TContractMethod,
  TBlockchainTransactionOutcome,
} from '@shared/Ethereum'
import {addressByContractAndNetwork} from '@shared/ethereum/account'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {toBuffer, bufferToHex} from 'ethereumjs-util'
import {TNotifyTxBroadcastJobParams} from '@shared/webhookHandler'
import {boss, notifyJobOpts} from '@shared/jobs/boss'
import * as Web3 from 'web3'
import {log} from '@shared/logger'

const envPr = env()

export type TTryTxResult = {
  success: boolean
  error?: string
  tx?: Tx
  attempt?: TxAttempt
}

export const trySendTx = async (
  func: TContractMethod,
  fName: string,
  txOptions: TransactionOptions,
  args: any[]
): Promise<TBlockchainTransactionOutcome> => {
  log(`
  Trying to send tx
  func: ${fName}
  args: ${JSON.stringify(args)}
  txOptions: ${JSON.stringify(txOptions)}
  `)
  try {
    args.push(txOptions)
    const estimatedGas = await func.estimateGas.apply(null, args)
    if (txOptions.gas) {
      if (txOptions.gas < estimatedGas) {
        return {
          kind: 'invalid_transaction',
          message: `insufficient gas for method ${fName}`,
        }
      }
    }
    const txHash = await func.sendTransaction.apply(null, args)
    log(
      `
      ${fName} output:
      ${txHash}
      `
    )
    return {
      kind: 'success',
      txHash: txHash,
    }
  } catch (e) {
    log(
      `
    Failed to estimate gas for ${fName}
    Error: ${e.message}
    `,
      {level: 'warn'}
    )
    return {
      kind: 'invalid_transaction',
      message: `failed to estimate gas for method ${fName}. tx would probably fail`,
    }
  }
}

export const gasPriceTooHigh = async (gasPrice: BigNumber): Promise<boolean> => {
  let e = await envPr
  if (e.maxGasPrice) {
    const maxGasPrice = new BigNumber(e.maxGasPrice)
    if (gasPrice.gt(maxGasPrice)) {
      log(`Gas price too high ${gasPrice} greater than ${maxGasPrice}`)
      return true
    }
  }
  log(`Gas price should have passed`)
  return false
}

export const tryTx = async (tx: Tx): Promise<TTryTxResult> => {
  if (await tx.hasTxConflicts()) {
    log(`TryTx: Tx ${tx.id} delayed due to pending conflicts`)
    return {success: false, error: 'tx_conflicts'}
  }

  log('TryTx starting...')

  try {
    log('TryTx: Fetching gas price...')

    const gasPrice = (await GasPrice.latest()).average

    log(`Received gas price ${gasPrice}`)

    if (await gasPriceTooHigh(gasPrice)) {
      return {success: false, error: 'gas_price_too_high'}
    }

    log(`TryTx: Proceeding with gas price: ${gasPrice}`)

    const maxNonce = await MaxNonce.getSenderNonce(tx.sender_address, tx.network)

    await maxNonce.synchronizeIfBehind()

    log(`TryTx: Using nonce: ${maxNonce.nonce}`)

    const attempt = await TxAttempt.create({
      network: tx.network,
      tx_id: tx.id,
      gas_price: gasPrice,
      nonce: maxNonce.nonce,
      sender_address: tx.sender_address,
    })

    log(`TryTx: TxAttempt: ${JSON.stringify(attempt.get({plain: true}))}`)

    const txOptions: TransactionOptions = {
      gasPrice: gasPrice,
      nonce: maxNonce.nonce,
      from: await addressByContractAndNetwork(tx.contract_name, tx.network),
    }

    log(`TryTx: TxOptions: ${txOptions}`)

    return commitTx(
      tx.getJobFn()(txOptions, tx.jobParams(), tx.network),
      tx,
      attempt,
      maxNonce
    )
  } catch (e) {
    log(`unhandled failure ${e}`)
    return {success: false, error: 'unhandled_failure'}
  }
}

export type TtxJobFn = (
  ...args: any[]
) => Promise<IWithPrivateEngineResult<TBlockchainTransactionOutcome>>

export const commitTx = async (
  jobFn: Promise<IWithPrivateEngineResult<TBlockchainTransactionOutcome>>,
  tx: Tx,
  attempt: TxAttempt,
  maxNonce?: MaxNonce
) => {
  try {
    const senderBalance = await getSenderBalance(
      bufferToHex(attempt.sender_address),
      attempt.network
    )
    const senderTxCount = await getSenderTxCount(
      bufferToHex(attempt.sender_address),
      attempt.network,
      'latest'
    )
    const wrappedOutcome = await jobFn
    const outcome = wrappedOutcome.result
    log(['WROE Received outcome', outcome, wrappedOutcome])
    const txData = wrappedOutcome.txData[0]
    if (outcome.kind === 'success') {
      if (maxNonce) {
        await maxNonce.incrementNonce()
      }
      log('WROE TX SUCCESS')
      log(
        {
          name: 'ContractEvent',
          event: {
            Subtype: 'CommitTx',
            Action: tx.method,
            TxHash: outcome.txHash,
            Nonce: attempt.nonce,
            SenderBalance: senderBalance,
            SenderTxCount: senderTxCount,
            Network: attempt.network,
          },
        },
        {event: true}
      )
      if (tx.status !== 'broadcast') {
        await tx.update({status: 'broadcast'})
      }
      await attempt.update({txhash: toBuffer(outcome.txHash)})
      log('WROE TxAttempt updated')
      if (tx.webhook.broadcast) {
        let boss_instance = await boss
        boss_instance.publish(
          'notify-tx-broadcast',
          {
            txId: tx.id,
            txAttemptId: attempt.id,
            txData,
          } as TNotifyTxBroadcastJobParams,
          notifyJobOpts
        )
      }
      return {success: true, tx: tx, attempt}
    } else {
      log('WROE TX FAIL')
      log(
        {
          name: 'ContractError',
          event: {
            Subtype: 'GetTxError',
            Action: tx.method,
            Sender: bufferToHex(tx.sender_address),
            Message: outcome.message,
          },
        },
        {event: true}
      )
      await attempt.update({status: 'failed'})
      return {success: false, error: 'broadcast_error'}
    }
  } catch (e) {
    log('Unhandled commitTx error', e)
    log(
      {
        name: 'ContractError',
        event: {
          Subtype: 'MetaGetTxError',
          Action: tx.method,
          Sender: bufferToHex(tx.sender_address),
        },
      },
      {event: true}
    )
    await attempt.update({status: 'failed'})
    return {success: false, error: 'unhandled_broadcast_error'}
  }
}

export const tryTxJob = async (job: any) => {
  await tryTxJobInner(job)
}

export const tryTxJobInner = async (job: any) => {
  const tx = await Tx.findOne({where: {id: job.data.tx_id}})
  if (!tx) {
    return
  }
  if (tx.estimate_retries >= tx.max_estimate_retries) {
    log(`Marking job for tx ${tx.id} as failed`)
    await tx.update({status: 'failed'})
  }
  try {
    var result: TTryTxResult = await tryTx(tx)
  } catch (err) {
    log('Unhandled tryTx error', err)
    result = {success: false, error: 'unhandled_trytx_error'}
  }
  if (result.success) {
    // return {success: true, tx: inputTx, attempt}
    log(
      `Job succeeded (tx ${result.tx ? result.tx.id : '???'}, txattempt ${
        result.attempt ? result.attempt.id : '???'
      })`
    )
    return
  } else {
    log(
      `Job failure (tx ${result.tx ? result.tx.id : '???'}, txattempt ${
        result.attempt ? result.attempt.id : '???'
      })`
    )
    switch (result.error) {
      case 'tx_conflicts':
        break
      case 'gas_price_too_high':
        break
      case 'unhandled_trytx_error':
        break
      case 'broadcast_error':
        await tx.addRetry()
        break
      default:
        log(`Unspecified tryTx result code in ${JSON.stringify(result)}`)
        await tx.addRetry()
        break
    }
    log(`Job for tx ${tx.id} uncompleted, attempting retry soon`)
    throw new Error(`Retryable job error`)
  }
}

export const getTxCount = (
  web3: any,
  sender_address: any,
  txStatus: 'latest' | 'pending'
): Promise<number> =>
  new Promise((resolve, reject) => {
    web3.eth.getTransactionCount(
      sender_address,
      txStatus,
      async (err: Error, count: number) => {
        if (err) {
          reject(err)
        } else {
          resolve(count)
        }
      }
    )
  })

export const getSenderTxCount = async (
  sender_address: string,
  network: ENetworks,
  txStatus: 'latest' | 'pending'
): Promise<number> =>
  await withReadOnlyEngine({stage: network}, async readOnlyProvider => {
    // log('GSTC ROP', readOnlyProvider)
    console.log('GTSC params', sender_address, network, readOnlyProvider)
    const web3 = new Web3(readOnlyProvider)
    return getTxCount(web3, sender_address, txStatus)
  })

export const getBalance = (web3: any, sender_address: any): Promise<number> =>
  new Promise((resolve, reject) => {
    web3.eth.getBalance(sender_address, async (err: Error, balance: string) => {
      if (err) {
        reject(err)
      } else {
        resolve(JSON.parse(web3.fromWei(balance)))
      }
    })
  })

export const getSenderBalance = async (
  sender_address: string,
  network: ENetworks
): Promise<number> =>
  await withReadOnlyEngine({stage: network}, async readOnlyProvider => {
    // log('GSTC ROP', readOnlyProvider)
    console.log('GSB params', sender_address, network, readOnlyProvider)
    const web3 = new Web3(readOnlyProvider)
    return getBalance(web3, sender_address)
  })

/*
export const getSenderNonce = (sender_address: any) => {
  await withReadOnlyEngine({stage: inputTx.stage}, async readOnlyProvider => {
    const web3 = new Web3(readOnlyProvider)
    const count = await getTxCount(web3, sender_address, 'pending')
    return count
  })
}
*/
