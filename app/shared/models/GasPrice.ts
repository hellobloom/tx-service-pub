import * as Web3 from 'web3'
import * as BigNumber from 'bignumber.js'
import * as Sequelize from 'sequelize-typescript'

@Sequelize.Table({tableName: 'gas_prices'})
export default class GasPrice extends Sequelize.Model<GasPrice> {
  @Sequelize.Column({
    allowNull: false,
    primaryKey: true,
    unique: true,
  })
  block_number: number

  @Sequelize.CreatedAt created: Date
  @Sequelize.UpdatedAt updated: Date

  static async latest() {
    const latestGasPrice = await this.findOne({order: [['block_number', 'DESC']]})
    if (!latestGasPrice) throw new Error('No gas prices found!')

    return latestGasPrice
  }

  static async deleteOldPrices() {
    await this.sequelize.query(
      `DELETE FROM "gas_prices" 
        WHERE "block_number" NOT IN (SELECT "block_number" FROM "gas_prices" ORDER BY "updated" DESC LIMIT 500)`
    )
  }

  @Sequelize.Column({allowNull: false, type: Sequelize.DataType.DECIMAL})
  get safe_low(): BigNumber.BigNumber {
    return this.getBignumColumn('safe_low')
  }

  set safe_low(value: BigNumber.BigNumber) {
    this.setBignumColumn('safe_low', value)
  }

  @Sequelize.Column({allowNull: false, type: Sequelize.DataType.DECIMAL})
  get average(): BigNumber.BigNumber {
    return this.getBignumColumn('average')
  }

  set average(value: BigNumber.BigNumber) {
    this.setBignumColumn('average', value)
  }

  @Sequelize.Column({allowNull: false, type: Sequelize.DataType.DECIMAL})
  get fastest(): BigNumber.BigNumber {
    return this.getBignumColumn('fastest')
  }

  set fastest(value: BigNumber.BigNumber) {
    this.setBignumColumn('fastest', value)
  }

  private getBignumColumn(name: string): BigNumber.BigNumber {
    return new BigNumber.BigNumber(
      Web3.prototype.toWei(this.getDataValue(name), 'gwei')
    )
  }

  private setBignumColumn(name: string, value: BigNumber.BigNumber) {
    this.setDataValue(name, value.div(Web3.prototype.toWei(1, 'gwei')).toNumber())
  }
}
