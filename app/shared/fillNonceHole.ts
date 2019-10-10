import {GasPrice, Tx, TxAttempt} from '@shared/models'
import {TransactionOptions} from '@shared/contracts/truffle'
import {addressByContractAndNetwork} from '@shared/ethereum/account'
import {TTryTxResult, gasPriceTooHigh, commitTx} from '@shared/tryTx'
import {sendZeroValueTx} from '@shared/tx/sendZeroValueTx'
import {log} from '@shared/logger'

export const fillNonceHole = async (tx: Tx, nonce: number) => {
  log(`FNH 1: Starting WRE`)

  try {
    log(`FNH 0...`)

    let gasPrice = (await GasPrice.latest()).average
    log(`FNH 1: ${gasPrice}`)

    if (gasPriceTooHigh(gasPrice)) {
      return {success: false, error: 'gas_price_too_high'}
    }

    const newAttempt = await TxAttempt.create({
      network: tx.network,
      tx_id: tx.id,
      gas_price: gasPrice,
      nonce,
      sender_address: tx.sender_address,
    })

    log(`FNH 3: ${newAttempt.get({plain: true})}`)

    const txOptions: TransactionOptions = {
      gasPrice: gasPrice,
      nonce: nonce,
      from: await addressByContractAndNetwork(tx.contract_name, tx.network),
    }

    log(`FNH 4: ${txOptions}`)
    return commitTx(
      sendZeroValueTx(tx.contract_name, txOptions, tx.network),
      tx,
      newAttempt
    )
  } catch (e) {
    return {success: false, error: 'unhandled_failure'}
  }
}

export const fillNonceHoleJob = async (job: any) => {
  await fillNonceHoleJobInner(job)
}

export const fillNonceHoleJobInner = async (job: any) => {
  const tx = await Tx.findOne({where: {id: job.data.tx_id}})
  if (!tx) {
    return
  }
  try {
    var result: TTryTxResult = await fillNonceHole(tx, job.data.nonce)
  } catch (err) {
    log(`Unhandled fillNonceHole error: ${JSON.stringify(err)}`)
    result = {success: false, error: 'unhandled_fillNonceHole_error'}
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
      case 'gas_price_too_high':
        break
      case 'broadcast_error':
        log(`Broadcast failed: ${JSON.stringify(result)}`)
        break
      default:
        log(`Unspecified tryTx result code in: ${JSON.stringify(result)}`)
        break
    }
    log(`FillNonceHole job for tx ${tx.id} uncompleted, attempting retry soon`)
    throw new Error(`Retryable job error`)
  }
}
