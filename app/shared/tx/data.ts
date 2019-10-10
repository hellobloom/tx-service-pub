import * as Web3 from 'web3'
import {TxStatus} from '@shared/tx/status'

export type TxData = Web3.TxData & {
  hash: string
  networkId: number
  status: TxStatus
  blockNumber: number
}
