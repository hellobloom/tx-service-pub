import {Tx, TxAttempt} from '@shared/models'
import * as dc from 'deepcopy'
import {max, min} from 'ramda'
import {env} from '@shared/environment'
import {log} from '@shared/logger'

let envPr = env()

export const index = async (req: any, res: any) => {
  try {
    const where = req.body.where ? dc(req.body.where) : {}

    let per_page = req.body.per_page ? parseInt(req.body.per_page) : 100
    let page = req.body.page ? parseInt(req.body.page) : 0
    let offset = page * per_page

    let txs = await Tx.findAll({
      where: where,
      limit: per_page,
      offset: offset,
    })

    res.json({
      success: true,
      txs: txs,
      page: page,
      offset: offset,
      per_page: per_page,
    })
  } catch (err) {
    res.status(500).json({success: false, message: 'Invalid request'})
  }
}

export const show = async (req: any, res: any) => {
  try {
    let tx = await Tx.findOne({
      where: {
        id: req.params.id,
      },
    })
    res.json({success: true, tx: tx})
  } catch (err) {
    res.status(500).json({success: false, message: 'Invalid request'})
  }
}

// For backwards compatibility - txService.ts in corresponding app should use a proper EAppsFull name, can be deleted when this is universally the case
const appFromWebhookKey = (k: string) => {
  if (k === 'bloom-web') {
    return 'bloomWeb'
  } else if (k === 'attestation-kit') {
    return 'attestationKitAttester'
  } else if (k === 'attestation-kit-attester') {
    return 'attestationKitAttester'
  } else {
    return k
  }
}

export const create = async (req: any, res: any) => {
  let e = await envPr
  try {
    let webhookSettings =
      req.body.webhook || e.webhooks[appFromWebhookKey(req.body.webhook_key)]

    if (!webhookSettings) {
      log(
        {
          name: 'TxsWebhookAssignmentError',
          details: {
            appId: e.appId,
            webhookKey: req.body.webhook_key,
            level: 'critical',
          },
        },
        {full: true}
      )
      return res.status(406).json({
        success: false,
        message:
          'Webhook key not configured and/or webhook settings not specified in request',
      })
    }
    const rtx = req.body.tx

    log('Create tx request Tx: ', rtx)

    const tx = await Tx.build({
      network: rtx.network,
      contract_name: rtx.contract_name,
      method: rtx.method,
      args: rtx.args,
      webhook: webhookSettings,
      max_estimate_retries: rtx.max_estimate_retries || 100,
    })

    await tx.assignAddresses()

    log('Validating tx')

    // validation
    let validation = await tx.validateTx()

    if (!validation) {
      return res.status(406).json({success: false, message: 'Invalid transaction'})
    }

    log('Identifying Tx conflicts...')

    await tx.identifyTxConflicts()

    log(['Saving Tx', tx.get({plain: true})])

    await tx.save({})

    let expireIn = req.body.expireIn
      ? min(864000, max(0, req.body.expireIn.toString().replace(/[^\d]/g, ''))) +
        ' seconds'
      : '48 hours'

    const jobOptions = {
      expireIn,
      retryLimit: 20000, // Just a hard upper limit, max_estimate_retries is the real limit,
      retryDelay: 10,
      retryBackoff: true,
    }

    log(`Enqueueing Tx with options: ${jobOptions}`)

    await tx.enqueue({}, jobOptions)

    log(`tx: ${JSON.stringify(tx)}`)

    log(
      {
        name: 'ContractEvent',
        event: {
          Subtype: 'CreateTx',
          Action: rtx.method,
        },
      },
      {event: true}
    )

    res.status(200).json({success: true, tx})
  } catch (err) {
    console.log(err)
    log(['Error creating Tx', err])

    log(
      {
        name: 'ContractError',
        event: {
          Subtype: 'CreateTxError',
        },
      },
      {event: true}
    )

    res.status(500).json({success: false, message: 'Invalid request'})
  }
}

export const destroy = async (req: any, res: any) => {
  try {
    let tx = await Tx.findOne({
      where: {
        id: req.params.id,
      },
    })

    if (!tx) {
      return res.status(404).json({success: false, message: 'Tx not found'})
    }

    await TxAttempt.destroy({
      where: {
        tx_id: tx.id,
      },
    })

    await tx.destroy()

    res.json({success: true, tx: tx})
  } catch (err) {
    res.status(500).json({success: false, message: 'Invalid request'})
  }
}
