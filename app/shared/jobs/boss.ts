import {env} from '@shared/environment'
const PgBoss = require('pg-boss')

const boss_raw_promise = env().then(e => new PgBoss(e.dbUrl))

export const boss: Promise<any> = boss_raw_promise.then(async (boss_raw: any) => {
  await boss_raw.start()
  return boss_raw
})

export const notifyJobOpts = {
  retryLimit: 5,
  retryDelay: 15,
  retryBackoff: true,
}
