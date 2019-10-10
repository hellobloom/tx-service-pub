import * as S from 'sequelize-typescript'
import {sequelize} from '@shared/models'
import {getSenderTxCount} from '@shared/tryTx'

import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {bufferToHex} from 'ethereumjs-util'
import {NetworkDataType} from '@shared/models/Tx'
import {log} from '@shared/logger'

@S.Table({tableName: 'max_nonces'})
export default class MaxNonce extends S.Model<MaxNonce> {
  @S.Column({
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    unique: true,
  })
  id: number

  @S.CreatedAt created: Date
  @S.UpdatedAt updated: Date

  @S.Column({
    type: S.DataType.BLOB,
    allowNull: false,
  })
  sender_address: Buffer

  @S.Column({
    type: S.DataType.INTEGER,
    allowNull: false,
  })
  nonce: number

  @S.Column({
    type: NetworkDataType,
    allowNull: false,
  })
  network: ENetworks

  lockForTransaction = (transaction: any) => {
    return sequelize.query(
      'select * from max_nonces where id = ? for update nowait',
      {
        transaction: transaction,
        replacements: [this.id],
      }
    )
  }

  incrementNonce = async () => {
    this.update({
      nonce: S.Sequelize.literal('nonce + 1'),
    })
  }

  synchronize = async () => {
    const addrString = bufferToHex(this.sender_address)
    const newNonce = await getSenderTxCount(addrString, this.network, 'pending')
    log(`Got new nonce for ${addrString}: ${newNonce}`)
    await this.update({nonce: newNonce})
  }

  synchronizeIfBehind = async () => {
    const addrString = bufferToHex(this.sender_address)
    const newNonce = await getSenderTxCount(addrString, this.network, 'pending')
    log(`Got new nonce for ${addrString}: ${newNonce}`)
    if (newNonce > this.nonce) {
      await this.update({nonce: newNonce})
    }
  }

  static getSenderNonce = async (sender_address: Buffer, network: ENetworks) => {
    var sender = await MaxNonce.findOne({
      where: {sender_address: sender_address, network: network},
    })
    if (sender) {
      return sender
    } else {
      const newNonce = await getSenderTxCount(bufferToHex(sender_address), network, 'pending')
      log(`Got new nonce for ${sender_address}: ${newNonce}`)
      let nonce = await MaxNonce.create({
        network,
        sender_address,
        nonce: newNonce,
      })
      return nonce
    }
  }
}
