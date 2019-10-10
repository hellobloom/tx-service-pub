import * as S from 'sequelize-typescript'
import {Op} from 'sequelize'
import {log} from '@shared/logger'
import {TxAttempt} from '@shared/models/index'
import {TxStatus} from '@shared/tx/status'
import {TxConflicts} from '@shared/tx/conflicts'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {addressByContractAndNetwork} from '@shared/ethereum/account'
import {boss} from '@shared/jobs/boss'
import {EContractNames} from '@shared/tx/method_manifest'
import * as C from '@shared/tx/method_manifest'
import {jobFnForTx} from '@shared/tx/loader'

import {validateAttestForParams} from '@shared/tx/attestFor/validate'
import {validateAddAddressToAccountForParams} from '@shared/tx/linkAddresses/validate'
import {validateRemoveAddressFromAccountForParams} from '@shared/tx/unlinkAddress/validate'
import {
  validateVoteForParams,
  validateBatchAttestParams,
} from '@shared/tx/voteFor/validate'
import {toBuffer, bufferToHex} from 'ethereumjs-util'
import {TWebhookDualTXS} from '@shared/envUtils'
import {getContractAddr} from '@shared/environment'

export const TxStatusDataType = S.DataType.ENUM(Object.keys(TxStatus))
export const NetworkDataType = S.DataType.ENUM(Object.keys(ENetworks))

@S.Table({tableName: 'txs'})
export default class Tx extends S.Model<Tx> {
  @S.Column({
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  id: number

  // Timestamps

  @S.CreatedAt created: Date
  @S.UpdatedAt updated: Date

  /*  @S.Column({
    type: S.DataType.DATE,
    allowNull: false,
  })
  started: Date */

  // Transaction meta-info

  @S.Column({type: S.DataType.BLOB})
  sender_address: Buffer

  /* @S.Column({
    type: S.DataType.INTEGER,
  })
  nonce: number */

  @S.Column({
    type: NetworkDataType,
    allowNull: false,
  })
  network: ENetworks

  @S.Column({
    type: S.DataType.TEXT,
    allowNull: false,
  })
  contract_name: EContractNames

  @S.Column({
    type: S.DataType.BLOB,
    allowNull: false,
  })
  contract_address: Buffer

  @S.Column({
    type: S.DataType.TEXT,
    allowNull: false,
  })
  method: string

  // To avoid any confusion or annoying marshalling back and forth to Buffer, binary arguments should be stored as an array of 0x hex values via ethereumjs-util bufferToHex for easy storage in JSONB
  @S.Column({
    type: S.DataType.JSONB,
    allowNull: false,
  })
  args: any

  // Number of job retries (only counting actual gas estimation retries, not "Gas price too high", "Transaction is blocked", etc.)
  @S.Column({
    type: S.DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  estimate_retries: number

  @S.Column({
    type: S.DataType.INTEGER,
    allowNull: false,
    defaultValue: 200,
  })
  max_estimate_retries: number

  @S.Column({
    type: TxStatusDataType,
    allowNull: false,
    defaultValue: 'pending',
  })
  status: TxStatus

  @S.Column({
    type: S.DataType.BLOB,
    allowNull: true,
  })
  txhash: Buffer

  /* @S.Column({
    allowNull: false,
    type: S.DataType.BOOLEAN,
    defaultValue: false,
  })
  sending_failed: boolean */

  @S.HasMany(() => TxAttempt, {
    foreignKey: 'tx_id',
  })
  TxAttempts: TxAttempt[]

  @S.Column({
    allowNull: true,
    type: S.DataType.ARRAY(S.DataType.INTEGER),
    defaultValue: false,
  })
  blocking_txs: number[]

  @S.Column({
    allowNull: false,
    type: S.DataType.JSONB,
    defaultValue: null,
  })
  webhook: TWebhookDualTXS

  hasTxConflicts = async () => {
    if (!this.blocking_txs) {
      throw new Error('hasTxConflicts called before blocking_txs identified')
    }
    const conflicts = await Tx.findAll({
      attributes: [[S.Sequelize.fn('COUNT', S.Sequelize.col('*')), 'count']],
      where: {
        id: {
          [Op.in]: this.blocking_txs,
        },
        status: {
          [Op.in]: ['pending', 'broadcast'],
        },
      },
    })
    log(['conflicts result', JSON.stringify(conflicts[0].getDataValue('count'))])
    log([
      'conflicts bool',
      parseInt(conflicts[0].getDataValue('count')) > 0,
      this.blocking_txs,
    ])
    return parseInt(conflicts[0].getDataValue('count')) > 0
  }

  assignAddresses = async () => {
    log('TX-AA 0', {level: 'debug'})
    this.contract_address = toBuffer(
      this.args.pollAddress
        ? this.args.pollAddress
        : await getContractAddr(this.contract_name, this.network)
    )
    log('TX-AA 1', {level: 'debug'})
    this.sender_address = toBuffer(
      await addressByContractAndNetwork(this.contract_name, this.network)
    )
    log('TX-AA 2', {level: 'debug'})
  }

  identifyTxConflicts = async () => {
    log(['ITC: Identifying TX conflicts', this.get({plain: true})], {level: 'debug'})
    try {
      let conflictingTxIds: number[] = []
      if (TxConflicts.hasOwnProperty(this.contract_name)) {
        if (TxConflicts[this.contract_name].hasOwnProperty(this.method)) {
          const conflictingMethods = TxConflicts[this.contract_name][this.method]
          log(['ITC: conflictingMethods', JSON.stringify(conflictingMethods)], {
            level: 'debug',
          })
          conflictingTxIds = (await Tx.findAll({
            attributes: ['id'],
            raw: true,
            where: {
              network: this.network,
              [Op.or]: conflictingMethods.map((cx: any) => ({
                contract_name: cx.contract,
                method: cx.method,
                [Op.or]: cx.fields.map((cxf: any) => ({
                  args: {
                    [stripUnderscore(cxf.remote)]: this.args[
                      stripUnderscore(cxf.local)
                    ],
                  },
                })),
              })),
            },
          })).map((tx: Tx) => tx.id)
        }
      }
      log(['ITC: conflictingMethods', conflictingTxIds], {level: 'debug'})
      this.blocking_txs = conflictingTxIds
      return conflictingTxIds
    } catch (err) {
      log([
        'Error identifying transaction conflicts',
        err,
        this.contract_name,
        this.method,
        this.args,
      ])
      throw err
    }
  }

  validateTx = async () => {
    switch (this.method) {
      case 'attestFor':
        return await validateAttestForParams(this.jobParams())
      case 'unlinkAddress':
        return await validateRemoveAddressFromAccountForParams(this.jobParams())
      case 'linkAddresses':
        return await validateAddAddressToAccountForParams(this.jobParams())
      case 'voteFor':
        return await validateVoteForParams(this.jobParams())
      case 'batchAttest':
        return await validateBatchAttestParams(this.jobParams())
      default:
        throw new Error('Validation attempted for unhandled job type')
    }
  }

  // This could have typed job options, not bothering for the single job
  enqueue = async (opts: any, jobOpts: TJobOptions) => {
    let boss_instance = await boss
    boss_instance.publish('try-tx', Object.assign(opts, {tx_id: this.id}), jobOpts)
  }

  getJobFn = () => jobFnForTx(this)

  rehydrateParam = (key: any) => {
    let x = this.args[key]
    if (typeof x === 'object' && x.hasOwnProperty('type') && x.type === 'Buffer') {
      return Buffer.from(x.data)
    } else if (typeof x === 'string' && x.substr(0, 2) === '0x') {
      // this could potentially break the unusual case of someone entering a string which starts with 0x, who wants it to be kept a string while being passed into a contract... if that ever happens, the endpoint will have to accept only JSON.stringify'ed buffer objects
      return toBuffer(x)
    } else {
      return x
    }
  }

  /* jobParams = () =>
    Object.keys(this.args).reduce(
      (acc: object, key: string) =>
        Object.assign({}, acc, {[key]: this.rehydrateParam(key)}),
      {}
    ) */

  jobParams = () => this.args

  addRetry = async () => {
    await this.update({
      estimate_retries: this.sequelize.literal('estimate_retries + 1'),
    })
  }

  // deprecated, slightly broken
  argsAsArray = (opts: any = {}) => {
    let contract = C[this.contract_name]
    let rehydrated = this.jobParams()
    let orderedArgs = contract[this.method].args_arr.map(
      (x: string) => rehydrated['_' + x]
    )
    if (opts.stringifyBuffers) {
      orderedArgs = orderedArgs.map((x: any, i: number) => {
        if (x instanceof Buffer) return bufferToHex(x)
        return x
      })
    }
    return orderedArgs
  }

  forTransport = () =>
    Object.assign({}, this.get({plain: true}), {
      sender_address: bufferToHex(this.sender_address),
      contract_address: bufferToHex(this.contract_address),
      txhash: bufferToHex(this.txhash),
      // args: this.args, // this.argsAsArray({stringifyBuffers: true}),
    })
}

export type TJobOptions = {
  expireIn: string // PostgreSQL interval.  Can be manually sanitized
}

const stripUnderscore = (str: string) => {
  if (str[0] === '_') {
    return str.substr(1, str.length)
  } else {
    return str
  }
}
