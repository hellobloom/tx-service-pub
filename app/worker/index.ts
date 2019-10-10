import {sentry} from '@shared/logger'
import {env} from '@shared/environment'
import {boss} from '@shared/jobs/boss'
import {log} from '@shared/logger'

import {tryTxJob} from '@shared/tryTx'
import {rebroadcastTxJob} from '@shared/rebroadcastTx'
import {fillNonceHoleJob} from '@shared/fillNonceHole'
import {
  notifyTxFailedJob,
  notifyTxMinedJob,
  notifyTxBroadcastJob,
} from '@shared/webhookHandler'

export enum EJobNames {
  'try-tx' = 'try-tx',
  'rebroadcast-tx' = 'rebroadcast-tx',
  'fill-nonce-hole' = 'fill-nonce-hole',
  'notify-tx-failed' = 'notify-tx-failed',
  'notify-tx-broadcast' = 'notify-tx-broadcast',
  'notify-tx-mined' = 'notify-tx-mined',
}

const envPr = env()

envPr.then(e => {
  log(`disableWorker: ${e.disableWorker.toString()}`, {level: 'info'})
  if (!e.disableWorker) {
    boss.then(ready).catch(onError)
  }
})

const ready = async (boss: any) => {
  await sentry
  let e = await envPr

  boss.on('error', onError)

  const jobs = {
    'try-tx': tryTxJob,
    'rebroadcast-tx': rebroadcastTxJob,
    'fill-nonce-hole': fillNonceHoleJob,
    'notify-tx-failed': notifyTxFailedJob,
    'notify-tx-broadcast': notifyTxBroadcastJob,
    'notify-tx-mined': notifyTxMinedJob,
  }

  Object.keys(jobs).forEach((key: string) => {
    if (e.workers[key]) {
      boss
        .subscribe(key, {teamSize: 1, teamConcurrency: 1}, jobs[key])
        .then(() => log('Subscribed to ' + key, {level: 'info'}))
        .catch(onError)
    }
  })
}

function onError(error: Error) {
  console.log(`OE DEBUG job failed`)
  log(
    {
      error: error,
      details: {
        message: 'Retryable job error',
      },
    },
    {full: true}
  )
}
