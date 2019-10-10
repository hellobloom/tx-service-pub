import fetch from 'node-fetch'
import {log} from '@shared/logger'
import {Tx, TxAttempt} from '@shared/models'
import {TWebhookDualTXS} from '@shared/envUtils'

// import {primaryWallet} from '@shared/attestations/attestationWallets'

export const genHeaders = async (
  headers: any,
  str: string,
  webhook: TWebhookDualTXS
) => {
  return Object.assign({}, headers, {
    'content-type': 'application/vnd.api+json',
    accept: 'application/json',
    api_token: webhook.key,
  })
}

export const webhookRequest = async (
  action: string,
  opts: any,
  webhook: TWebhookDualTXS
) => {
  const url = (webhook.address || (webhook as any).host) + action
  log(`Sending request to webhook: ${url}`, {level: 'debug'})

  const request_body = JSON.stringify({
    tx: opts.tx.forTransport(),
    tx_attempt: opts.attempt ? opts.attempt.forTransport() : null,
    tx_data: opts.tx_data ? opts.tx_data : null,
    error: opts.error ? opts.error : null,
  })

  const headers = genHeaders({}, request_body, webhook)
  const response = await fetch(url, {
    method: 'POST',
    body: request_body,
    headers: await headers,
  })

  return response.json()
}

export const notifyTxBroadcast = async (opts: {
  tx: Tx
  attempt: TxAttempt
  txData: string
}) => {
  return await webhookRequest('/api/webhooks/tx_broadcast', opts, opts.tx.webhook)
}

export const notifyTxMined = async (opts: {tx: Tx; attempt: TxAttempt}) => {
  return await webhookRequest('/api/webhooks/tx_mined', opts, opts.tx.webhook)
}

export const notifyTxFailed = async (opts: {tx: Tx; error: any}) => {
  await webhookRequest('/api/webhooks/tx_failed', opts, opts.tx.webhook)
}

export type TNotifyTxBroadcastJobParams = {
  txId: number
  txAttemptId: number
  txData: string
}
export type TNotifyTxMinedJobParams = {
  txId: number
  txAttemptId: number
  txData: string
}
export type TNotifyTxFailedJobParams = {
  txId: number
  error: any
}

export const notifyTxBroadcastJob = async (job: {
  data: TNotifyTxBroadcastJobParams
}) => {
  const tx = await Tx.findById(job.data.txId)
  if (!tx) {
    log('No tx in notifyTxBroadcastJob', {full: true, tags: job.data})
    return false
  }
  const attempt = await TxAttempt.findById(job.data.txAttemptId)
  if (!attempt) {
    log('No attempt in notifyTxBroadcastJob', {full: true, tags: job.data})
    return false
  }
  return notifyTxBroadcast({tx, attempt, txData: job.data.txData})
}

export const notifyTxMinedJob = async (job: {data: TNotifyTxMinedJobParams}) => {
  const tx = await Tx.findById(job.data.txId)
  if (!tx) {
    log('No tx in notifyTxMinedJob', {full: true, tags: job.data})
    return false
  }
  const attempt = await TxAttempt.findById(job.data.txAttemptId)
  if (!attempt) {
    log('No attempt in notifyTxMinedJob', {full: true, tags: job.data})
    return false
  }
  return notifyTxMined({tx, attempt})
}

export const notifyTxFailedJob = async (job: {data: TNotifyTxFailedJobParams}) => {
  const tx = await Tx.findById(job.data.txId)
  if (!tx) {
    log('No tx in notifyTxFailedJob', {full: true, tags: job.data})
    return false
  }
  return notifyTxFailed({tx, error: job.data.error})
}
