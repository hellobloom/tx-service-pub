import * as BigNumber from 'bignumber.js'
import * as Web3 from 'web3'
import fetch from 'node-fetch'

import {GasPrice} from '@shared/models'
import {log} from '@shared/logger'

interface IETHGasAPI {
  block_time: number
  fastestWait: number
  blockNum: number
  safeLow: number
  fastWait: number
  safeLowWait: number
  speed: number
  average: number
  fastest: number
  fast: number
  avgWait: number
}

const gasPriceUrl = 'https://ethgasstation.info/json/ethgasAPI.json'

function gasStationFormatToBignumber(value: number): BigNumber.BigNumber {
  return new BigNumber.BigNumber(Web3.prototype.toWei(value / 10, 'gwei'))
}

async function updateGasPrices() {
  const response = await fetch(gasPriceUrl)
  const {safeLow, average, fastest, blockNum}: IETHGasAPI = await response.json()

  await GasPrice.upsert({
    safe_low: gasStationFormatToBignumber(safeLow),
    average: gasStationFormatToBignumber(average),
    fastest: gasStationFormatToBignumber(fastest),
    block_number: blockNum,
  })
  await GasPrice.deleteOldPrices()
}

/**
 * Check the latest gas price stats every 60 seconds
 */
async function main() {
  try {
    await updateGasPrices()
  } catch (error) {
    log(`Error while updating gas price: ${JSON.stringify({error})}`, {full: true})
  }

  setTimeout(main, 60 * 1000)
}

main()
  .then(() => log('gas_worker: Done!'))
  .catch(error => log(`Error syncing gas price! ${error}`, {full: true}))
