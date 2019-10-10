import * as S from 'sequelize-typescript'
import {Tx} from '@shared/models/index'
import {OnchainTxStatus} from '@shared/tx/status'
import {NetworkDataType} from '@shared/models/Tx'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {bufferToHex} from 'ethereumjs-util'
import * as BigNumber from 'bignumber.js'
import * as Web3 from 'web3'
import {boss} from '@shared/jobs/boss'
import {log} from '@shared/logger'

export const OnchainTxStatusDataType = S.DataType.ENUM(Object.keys(OnchainTxStatus))

const defaultOptions = {
  expireIn: '48 hours',
  retryLimit: 20000, // Just a hard upper limit, max_estimate_retries is the real limit,
  retryDelay: 10,
  retryBackoff: true,
}

@S.Table({tableName: 'tx_attempts'})
export default class TxAttempt extends S.Model<Tx> {
  @S.Column({
    allowNull: false,
    primaryKey: true,
    autoIncrement: true,
    unique: true,
  })
  id: number

  // Timestamps

  @S.CreatedAt created: Date
  @S.UpdatedAt updated: Date

  @S.Column({
    type: S.DataType.INTEGER,
    allowNull: false,
  })
  nonce: number

  // Transaction meta-info

  @S.Column({type: S.DataType.BLOB})
  sender_address: Buffer

  @S.Column({
    type: S.DataType.INTEGER,
  })
  gas: number

  @S.Column({allowNull: false, type: S.DataType.DECIMAL})
  get gas_price(): BigNumber.BigNumber {
    return this.getBignumColumn('gas_price')
  }

  set gas_price(value: BigNumber.BigNumber) {
    this.setBignumColumn('gas_price', value)
  }

  // The actual txhash/ethereum tx id (not to be confused with the foreign key of the tx table, tx_id)
  @S.Column({
    type: S.DataType.BLOB,
    allowNull: true,
  })
  txhash: Buffer

  @S.Column({
    type: S.DataType.INTEGER,
    allowNull: false,
  })
  tx_id: string

  @S.BelongsTo(() => Tx, {
    foreignKey: 'tx_id',
  })
  Tx?: Tx

  @S.Column({
    type: NetworkDataType,
    allowNull: false,
  })
  network: ENetworks

  @S.Column({
    type: OnchainTxStatusDataType,
    allowNull: false,
    defaultValue: 'pending',
  })
  status: OnchainTxStatus

  private getBignumColumn(name: string): BigNumber.BigNumber {
    return new BigNumber.BigNumber(
      Web3.prototype.toWei(this.getDataValue(name), 'gwei')
    )
  }

  private setBignumColumn(name: string, value: BigNumber.BigNumber) {
    this.setDataValue(name, value.div(Web3.prototype.toWei(1, 'gwei')).toNumber())
  }

  static async findTxsToUpdate(sender: Buffer, distinctLimit: number) {
    let pendingTxs = await this.findPending(sender, distinctLimit)
    if (!pendingTxs.length) return pendingTxs
    // Check if blocking tx has more than 10 attempts
    const blockingAttempts = await TxAttempt.findAndCount({
      where: {status: OnchainTxStatus['pending'], tx_id: pendingTxs[0].tx_id},
    })
    if (blockingAttempts.count > 10) {
      pendingTxs = blockingAttempts.rows
    }
    return pendingTxs
  }

  static async findPending(sender: Buffer, limit: number) {
    return this.findAll({
      where: {
        status: OnchainTxStatus['pending'],
      },
      order: [['nonce', 'ASC'], ['gas_price', 'DESC']],
      limit: limit,
      include: [{model: Tx, required: true}],
    })
  }

  static async findBlocking(sender: Buffer) {
    return this.findOne({
      where: {
        status: OnchainTxStatus['pending'],
        sender_address: sender,
      },
      order: [['nonce', 'ASC'], ['gas_price', 'DESC']],
    })
  }

  forTransport = () =>
    Object.assign({}, this.get({plain: true}), {
      sender_address: bufferToHex(this.sender_address),
      txhash: bufferToHex(this.txhash),
    })

  fillNonceHole = async (opts: any, nonce: number) => {
    if (!this.Tx) {
      log(`FNH 0: tx not found for ${this.id}`, {level: 'info'})
      return
    }
    log('FNH 1', {level: 'debug'})
    const tx = await Tx.build({
      network: this.network,
      contract_name: this.Tx.contract_name,
      blocking_txs: [],
      method: '',
      args: {},
      webhook: {host: '', key: '', broadcast: false, mined: false, failed: false},
      max_estimate_retries: 100,
    })
    log('FNH 2', {level: 'debug'})
    tx.assignAddresses()
    log('FNH 3', {level: 'debug'})
    log(['Saving Tx', tx.get({plain: true})], {level: 'debug'})
    await tx.save({})
    log('FNH 4', {level: 'debug'})
    let boss_instance = await boss
    boss_instance.publish(
      'fill-nonce-hole',
      Object.assign(opts, {tx_id: tx.id, nonce: nonce}),
      // add singleton key so the same hole does not get multiple fill attempts
      // fill attempts will be rebroadcast with higher gas if needed through same mechanism as normal txs
      Object.assign(defaultOptions, {
        singletonKey:
          'fillNonceHoleAttempt' +
          this.id.toString(10) +
          '-nonce:' +
          nonce.toString(10),
      })
    )
  }

  rebroadcast = async (opts: any) => {
    let boss_instance = await boss
    boss_instance.publish(
      'rebroadcast-tx',
      Object.assign(opts, {attempt_id: this.id}),
      defaultOptions
    )
  }
}
