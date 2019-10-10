import {GasPrice, Tx, TxAttempt} from '@shared/models'
import {TransactionOptions} from '@shared/contracts/truffle'
import {addressByContractAndNetwork} from '@shared/ethereum/account'
import * as Web3 from 'web3'
import {TTryTxResult, gasPriceTooHigh, commitTx} from '@shared/tryTx'
import {log} from '@shared/logger'

export const reBroadcastTx = async (attempt: TxAttempt) => {
  log('RBT 1: Starting WRE')

  const tx = await Tx.findById(attempt.tx_id)
  if (!tx) {
    log(`RBT 2: tx not found for ${attempt.tx_id}`)
    return {success: false, error: 'tx_not_found'}
  }

  // Don't rebroadcast if a tx has been marked mined after this job was added to the queue
  // Should fail anyway due to nonce too low but if we get switched to a node that is a little behind
  // The tx would still broadcast
  const minedTx = await TxAttempt.findOne({
    where: {
      tx_id: attempt.tx_id,
      status: 'mined',
    },
  })
  if (minedTx) {
    log(
      `RBT 3: Rebroadcast job attempted after related tx already mined ${
        attempt.tx_id
      }`
    )
    return {success: false, error: 'tx_already_mined'}
  }

  try {
    log('Rebroadcast starting...')

    // if new gas is less than or equal to the gas price already attempted, resubmit with old + 1%
    var gasPrice = (await GasPrice.latest()).average
    log(`Rebroadcast: Latest gas price: ${gasPrice}`)
    log(`Rebroadcast: Old attempt gas price:${attempt.gas_price}`)

    if (gasPrice.lte(attempt.gas_price)) {
      gasPrice = attempt.gas_price.plus(Web3.prototype.toWei(0.1, 'gwei'))
    }

    log(`Rebroadcast: Proceeding with GasPrice: ${gasPrice}`)

    if (await gasPriceTooHigh(gasPrice)) {
      return {success: false, error: 'gas_price_too_high'}
    }

    log(`Rebroadcast: Using nonce: ${attempt.nonce}`)

    const newAttempt = await TxAttempt.create({
      network: tx.network,
      tx_id: tx.id,
      gas_price: gasPrice,
      nonce: attempt.nonce,
      sender_address: attempt.sender_address,
    })

    log(`Rebroadcast: TxAttempt: ${newAttempt.get({plain: true})}`)

    const txOptions: TransactionOptions = {
      gasPrice: gasPrice,
      nonce: attempt.nonce,
      from: await addressByContractAndNetwork(tx.contract_name, tx.network),
    }

    log(`Rebroadcast: TxOptions: ${txOptions}`)

    return commitTx(
      tx.getJobFn()(txOptions, tx.jobParams(), tx.network),
      tx,
      newAttempt
    )
  } catch (e) {
    console.log('Rebroadcast: uncaught error', e)
    return {success: false, error: 'unhandled_failure'}
  }
}

export const rebroadcastTxJob = async (job: any) => {
  await rebroadcastTxJobInner(job)
}

export const rebroadcastTxJobInner = async (job: any) => {
  const attempt = await TxAttempt.findOne({where: {id: job.data.attempt_id}})
  if (!attempt) {
    return
  }
  try {
    var result: TTryTxResult = await reBroadcastTx(attempt)
  } catch (err) {
    log('Unhandled rebroadcastTx error', err)
    result = {success: false, error: 'unhandled_rebroadcasttx_error'}
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
      case 'tx_not_found':
        log(`Corresponding tx for attempt not found: ${JSON.stringify(result)}`)
        break
      case 'tx_already_mined':
        log(
          `Corresponding tx was already mined in related attempt: ${JSON.stringify(
            result
          )}`
        )
        break
      case 'gas_price_too_high':
        break
      case 'broadcast_error':
        log(`Rebroadcast failed: ${JSON.stringify(result)}`)
        break
      default:
        log(`Unspecified tryTx result code in: ${JSON.stringify(result)}`)
        break
    }
    log(
      `Rebroadcast job for tx ${
        attempt.tx_id
      } uncompleted, will be requeued by worker`
    )
    return
  }
}
