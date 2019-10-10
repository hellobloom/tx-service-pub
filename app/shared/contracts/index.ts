import {EContractNames} from '@shared/tx/method_manifest'

// Note - doesn't export functions from other files in this directory - import those directly.

export type IContractMethodJobManifest = {
  [P in keyof typeof EContractNames]?: {
    [key: string]: string
  }
}

export type IJobContractMethodManifest = {
  [P in keyof typeof EContractNames]?: {
    [key: string]: string
  }
}

export const contractMethodsToJobs: IContractMethodJobManifest = {
  AccountRegistryLogic: {
    linkAddresses: 'link-registry-account',
    unlinkAddress: 'unlink-registry-account',
  },
  AttestationLogic: {
    attestFor: 'attest-for',
  },
  Poll: {voteFor: 'vote-for'},
  TokenEscrowMarketplace: {},
  VotingCenter: {},
  AirdropProxy: {},
}

// Flips contractMethodsToJobs to a manifest of {jobName: {contract: 'ContractName', method:'contractMethod'}}
export const jobsToContractMethods: IJobContractMethodManifest = Object.keys(
  contractMethodsToJobs
).reduce(
  (acc1: object, val1: string) =>
    Object.assign(
      acc1,
      Object.keys(contractMethodsToJobs[val1]).reduce(
        (acc2: object, val2: string) =>
          Object.assign(acc2, {
            [contractMethodsToJobs[val1][val2]]: {contract: val1, method: val2},
          }),
        {}
      )
    ),
  {}
)
