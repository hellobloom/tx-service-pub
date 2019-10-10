import {EContractNames} from '@shared/tx/method_manifest'

// Contract method functions
import {linkAddresses} from '@shared/tx/linkAddresses'
import {attestFor} from '@shared/tx/attestFor'
import {unlinkAddress} from '@shared/tx/unlinkAddress'
import {voteFor} from '@shared/tx/voteFor'

import {Tx} from '@shared/models'
import { batchAttest } from './batchAttest';

export enum EJobFns {
  'linkAddresses' = 'linkAddresses',
  'attestFor' = 'attestFor',
  'unlinkAddress' = 'unlinkAddress',
  'voteFor' = 'voteFor',
  'batchAttest' = 'batchAttest'
}

export enum EIrregularlyNamedJobFns {} // Just in case

export type TJobManifest = {[P in keyof typeof EJobFns]: any}

export const jobManifest: TJobManifest = {
  linkAddresses,
  attestFor,
  unlinkAddress,
  voteFor,
  batchAttest,
}

// Note - doesn't export functions from other files in this directory - import those directly.

export type IContractMethodJobFnMap = {
  [P in keyof typeof EContractNames]?: {
    [p in keyof typeof EJobFns]?: keyof typeof EJobFns
  }
}

export type IJobFnMethodDescriptor = {
  contract: string
  method: string
}

export type IJobFnContractMethodMap = {
  [P in keyof typeof EJobFns]: IJobFnMethodDescriptor
}

export const contractMethodsToJobFns: IContractMethodJobFnMap = {
  AccountRegistryLogic: {
    unlinkAddress: 'unlinkAddress',
    linkAddresses: 'linkAddresses',
  },
  AttestationLogic: {
    attestFor: 'attestFor',
  },
  Poll: {voteFor: 'voteFor'},
  TokenEscrowMarketplace: {},
  VotingCenter: {},
  AirdropProxy: {},
  BatchAttestationLogic: {batchAttest: 'batchAttest'}
}

// Flips contractMethodsToJobs to a manifest of {jobName: {contract: 'ContractName', method:'contractMethod'}}
//
var Obj = Object as any
export const jobsToContractMethods: IJobFnContractMethodMap = Object.keys(
  contractMethodsToJobFns
).reduce(
  (acc1: object, val1: string) =>
    Obj.assign(
      acc1,
      Obj.keys(contractMethodsToJobFns[val1]).reduce(
        (acc2: object, val2: string) =>
          Obj.assign(acc2, {
            [contractMethodsToJobFns[val1][val2]]: {contract: val1, method: val2},
          }),
        {}
      )
    ),
  {}
)

export const getJobFnName = (
  contract_name: EContractNames,
  method: string
): EJobFns | EIrregularlyNamedJobFns => {
  let contractJobs = contractMethodsToJobFns[contract_name]
  if (!contractJobs) throw new Error(`Unhandled contract: ${contract_name}`)
  let jobMethod = contractJobs[method]
  if (!jobMethod) throw new Error(`Unhandled job method: ${contract_name} ${method}`)
  return jobMethod
}

export const jobFnForTx = (tx: Tx) => {
  const jobFnName = getJobFnName(tx.contract_name, tx.method)
  return jobManifest[jobFnName]
}
