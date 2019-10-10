import {eachSeries, asyncify} from 'async'
import * as Web3 from 'web3'
import {TxAttempt} from '@shared/models'
import {log} from '@shared/logger'
import {withReadOnlyEngine} from '@shared/ethereum/customWeb3Provider'
import {bufferToHex} from 'ethereumjs-util'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {
  TNotifyTxFailedJobParams,
  TNotifyTxMinedJobParams,
} from '@shared/webhookHandler'
import {boss, notifyJobOpts} from '@shared/jobs/boss'
import {getSenderTxCount} from '@shared/tryTx'
import {OnchainTxStatus, TxStatus} from '@shared/tx/status'
import {Sequelize} from 'sequelize-typescript'

// Utility functions
const getTxReceipt = async (txHash: string, network: ENetworks) =>
  withReadOnlyEngine({stage: network}, async engine => {
    const web3 = new Web3(engine)
    return new Promise<Web3.TransactionReceipt | null>((resolve, reject) =>
      web3.eth.getTransactionReceipt(txHash, (err, receipt) =>
        err ? reject(err) : resolve(receipt)
      )
    )
  })

export enum TxOutcomes {
  NotFound,
  Mined,
  Failed,
}

export const txStatus = async (
  receipt: Web3.TransactionReceipt | null
): Promise<TxOutcomes> => {
  if (!receipt) {
    return TxOutcomes.NotFound
  }

  const status =
    typeof receipt.status === 'string'
      ? parseInt(receipt.status, 16)
      : receipt.status

  if (status === 1) {
    return TxOutcomes.Mined
  } else {
    return TxOutcomes.Failed
  }
}

export const receiptToStatusString = (txReceipt: {status: 0 | 1 | 2}) => {
  switch (txReceipt.status) {
    case 0:
      return 'pending'
    case 1:
      return 'mined'
    case 2:
      return 'failed'
    default:
      return 'not_supported'
  }
  // txReceipt.status === 1 || txReceipt.status === '0x1' ? 'mined' : 'failed'
}

export const updateTxStatus = async (attempt: TxAttempt) => {
  log(
    `Checking status on attempt ${attempt.id} for tx ${attempt.tx_id}: ${bufferToHex(
      attempt.txhash
    )}`,
    {level: 'info'}
  )
  // If tx doesn't get marked failed previously even though it has no tx hash, mark it here
  if (!attempt.txhash || !attempt.Tx) {
    await attempt.update({status: 'failed'})
    return
  }
  // If the Tx is mined don't bother checking this attempt
  if (attempt.Tx.status === TxStatus['mined']) {
    await attempt.update({status: 'failed'})
    return
  }
  const receipt = (await getTxReceipt(
    bufferToHex(attempt.txhash),
    attempt.network
  )) as any
  const status = await txStatus(receipt)
  const statusString = receiptToStatusString({status})
  if (statusString !== 'pending') {
    log(
      [
        `Updating attempt ${attempt.id} for tx ${
          attempt.tx_id
        } status: ${statusString}`,
        JSON.stringify(receipt),
        receipt.blockNumber,
        statusString === 'mined',
      ],
      {level: 'info'}
    )
    await attempt.update({
      status: statusString,
      block_number:
        statusString === 'mined' && receipt && receipt.blockNumber
          ? receipt.blockNumber
          : undefined,
    })

    let boss_instance = await boss
    const txUpdateParams: any = {status: statusString}
    if (statusString === 'mined') {
      txUpdateParams.txhash = attempt.txhash
      await attempt.Tx.update(txUpdateParams)
      if (attempt.Tx.webhook.mined) {
        boss_instance.publish(
          'notify-tx-mined',
          {txId: attempt.Tx.id, txAttemptId: attempt.id} as TNotifyTxMinedJobParams,
          notifyJobOpts
        )
      }
      // Mark related attempts as failed
      await TxAttempt.update(
        {
          status: OnchainTxStatus.failed,
        },
        {
          where: {
            sender_address: attempt.sender_address,
            nonce: attempt.nonce,
            id: {[Sequelize.Op.ne]: attempt.id},
          },
        }
      )
    } else if (statusString === 'failed') {
      if (attempt.Tx.webhook.failed) {
        boss_instance.publish(
          'notify-tx-failed',
          {
            txId: attempt.Tx.id,
            error: 'onchain_tx_rejection',
          } as TNotifyTxFailedJobParams,
          notifyJobOpts
        )
      }
    }
  } else {
    // If lowest pending nonce, rebroadcast with same nonce and higher gas price
    const blocking = await TxAttempt.findBlocking(attempt.sender_address)
    if (!blocking) return
    if (attempt.id === blocking.id) {
      const senderTxCount = await getSenderTxCount(
        bufferToHex(attempt.sender_address),
        attempt.network,
        'latest'
      )
      log(
        `UTS checking if TX/ attempt is blocking ${attempt.tx_id} / ${attempt.id}
              Sender tx count: ${senderTxCount}
              Attempt nonce ${attempt.nonce}`,
        {
          level: 'info',
        }
      )
      if (senderTxCount < attempt.nonce) {
        // Sanity check that there is no transaction with the missing nonce
        // Could happen if getSenderTxCount queries an out of sync geth node
        // Or if all txs get marked as failed and a gas price spike causes delays
        const missingTx = await TxAttempt.findOne({
          where: {
            sender_address: attempt.sender_address,
            network: attempt.network,
            nonce: senderTxCount,
            txhash: {[Sequelize.Op.ne]: null},
          },
          order: [['gas_price', 'DESC']],
        })
        if (missingTx) {
          // If all blocking txs got marked as failed and there's a gas price spike this could lead to a
          // delay in tx confirmations, so catch it and mark all potential txs as pending
          await missingTx.update({
            status: OnchainTxStatus.pending,
          })
          log(
            {
              name: 'ContractError',
              event: {
                Subtype: 'FixNonceHole',
                Sender: bufferToHex(attempt.sender_address),
                Network: attempt.network,
              },
            },
            {event: true}
          )
          log(
            [
              `Nonce hole identified but pending tx exists. Geth node out of sync`,
              attempt,
            ],
            {level: 'warn'}
          )
        } else {
          // Fill nonce hole
          log(
            `Filling nonce hole for sender ${bufferToHex(
              attempt.sender_address
            )} at nonce ${senderTxCount}`,
            {level: 'info'}
          )
          await attempt.fillNonceHole({}, senderTxCount)
        }
      } else if (senderTxCount > attempt.nonce) {
        // Detect chain reorg. If txs keep mining past our pending tx nonce
        // then one of the other attempts which were originally marked as failed
        // must have been mined on the accepted chain
        // Mark other broadcast txs as pending so the worker will recheck their status
        log(
          `UTS chain reorg detected for tx/ attempt ${attempt.tx_id} / ${attempt.id}
              Sender tx count: ${senderTxCount}
              Attempt nonce ${attempt.nonce}`,
          {
            level: 'info',
          }
        )
        await TxAttempt.update(
          {
            status: OnchainTxStatus.pending,
          },
          {
            where: {
              nonce: attempt.nonce,
              network: attempt.network,
              sender_address: attempt.sender_address,
              txhash: {[Sequelize.Op.ne]: null},
            },
          }
        )
      } else {
        log(`Rebroadcasting attempt ${attempt.id} for tx ${attempt.tx_id}`, {
          level: 'info',
        })
        await attempt.rebroadcast({})
      }
    }
  }
}

// Core loop functions

const updateEachTx = async (txs: TxAttempt[]) => {
  eachSeries(
    txs,
    asyncify(updateTxStatus),
    err => new Promise((resolve, reject) => (err ? reject(err) : resolve()))
  )
}
const updateTxs = async () => {
  const distinctAdmins = (await TxAttempt.aggregate('sender_address', 'DISTINCT', {
    plain: false,
  })) as Array<Object>
  if (!distinctAdmins.length) return
  const admins: Buffer[] = distinctAdmins.map(a => a['DISTINCT'])
  log(JSON.stringify(admins), {level: 'info'})
  let txs: TxAttempt[] = []
  for (let admin of admins) {
    log(`Finding txs for admin ${bufferToHex(admin)}`, {level: 'info'})
    txs = txs.concat(await TxAttempt.findTxsToUpdate(admin, 10))
  }
  if (!txs.length) {
    log('No txs found')
    return
  }
  return await updateEachTx(txs)
}

const main = async () => {
  try {
    await updateTxs()
  } catch (error) {
    log(`Encountered error updating txs! ${error} ${error.stack}}`, {level: 'info'})
  }

  setTimeout(main, 1000 * 30)
}

main()
  .then(() => log('Finished tracking transactions!', {level: 'info'}))
  .catch(error => log(['Failed tracking transactions!', error], {level: 'warn'}))
