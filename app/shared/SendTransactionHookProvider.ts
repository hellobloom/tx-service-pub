import {TxData} from '@shared/tx/data'
import * as Web3 from 'web3'
import {TxStatus} from '@shared/tx/status'

/**
 * Add a hook for all sent transactions
 *
 * This provider must be added BEFORE the provider that handles
 * eth_sendTransaction for it to work
 */
export default class SendTransactionHookProvider {
  constructor(
    private networkId: number,
    private hook: (tx: TxData) => Promise<any>
  ) {}

  setEngine(engine: Web3.Provider) {
    // dont remove this
  }

  handleRequest(payload: any, next: any, end: any) {
    next((err: any, result: any, callback: any) => {
      if (err) return callback(err)
      if (payload.method === 'eth_sendTransaction') {
        return this.hook({
          hash: result,
          networkId: this.networkId,
          status: TxStatus.pending,
          ...payload.params[0],
        })
          .then(() => {
            callback()
          })
          .catch((error: any) => callback(error))
      }
      callback()
    })
  }
}
