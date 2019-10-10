import {TransactionOptions} from '@shared/contracts/truffle'
import * as Web3 from 'web3'
import {IWithPrivateEngineResult} from '@shared/ethereum/customWeb3Provider'

interface IInvalidTransaction {
  kind: 'invalid_transaction'
  message: string
}

interface IFailedTransaction {
  kind: 'failed_transaction'
  message: string
}

interface ISuccess {
  kind: 'success'
  txHash: string
}

export type TBlockchainTransactionOutcome =
  | IInvalidTransaction
  | IFailedTransaction
  | ISuccess

export type TWrappedBlockchainTransaction = (
  options?: TransactionOptions,
  ...args: any[]
) => Promise<IWithPrivateEngineResult<TBlockchainTransactionOutcome>>

export type TBlockchainTransaction = (
  options?: TransactionOptions,
  ...args: any[]
) => Promise<TBlockchainTransactionOutcome>

export type TContractMethod = {
  (...args: any[]): Promise<Web3.TransactionReceipt>
  call(...args: any[]): Promise<Web3.TransactionReceipt>
  sendTransaction(...args: any[]): Promise<string>
  estimateGas(...args: any[]): Promise<number>
}
