import * as Web3 from 'web3'
import {
  TokenEscrowMarketplaceInstance,
  AccountRegistryLogicInstance,
  AttestationLogicInstance,
  VotingCenterInstance,
  PollInstance,
  AirdropProxyInstance,
  BatchAttestationLogicInstance,
} from './truffle'

/**
 * Process the data from a `build/contract/Foo.json` file and
 * turn it into an object that represents the corresponding contract
 */
const loadTruffleContract: <T>(
  data: object
) => IContract<T> = require('truffle-contract')

/**
 * Interface for a general contract which has not yet been resolved to
 * an instance of that contract at a given address.
 */
interface IContract<InstanceType> {
  contractName: string
  deployed(): Promise<InstanceType>
  at(address: string): InstanceType
  setProvider(provider: Web3.Provider): void
}

interface IConstructorMember {
  inputs: IFunctionMemberInput[]
  payable: false
  type: 'constructor'
}

interface IEventMember {
  inputs: IEventMemberInput[]
  name: string
  type: 'event'
}

interface IFunctionMember {
  inputs: IFunctionMemberInput[]
  outputs: IFunctionMemberInput[]
  name: string
  constant: boolean
  payable: boolean
  type: 'function'
}

export type SolidityType =
  | 'address'
  | 'address[]'
  | 'bool'
  | 'bytes'
  | 'bytes32'
  | 'string'
  | 'uint8'
  | 'uint16'
  | 'uint64'
  | 'uint256'
  | 'uint256[]'

export interface IFunctionMemberInput {
  name: string
  type: SolidityType
}

interface IEventMemberInput extends IFunctionMemberInput {
  indexed: boolean
}

export type Abi = (IEventMember | IFunctionMember | IConstructorMember)[]

export interface ITruffleDefinition {
  contractName: string
  abi: Abi
}

/**
 * Wrapper around contract data that has not yet been resolved into a contract
 * with a certain provider. In our app, we deal with the same contracts from
 * different accounts (read only accounts, metamask accounts, and specific admin
 * accounts we have). Instead of passing around a contract object, duping it, and
 * then calling `setProvider`, we use this concept of a contract that does not yet
 * have a provider attached to it.
 */
export class ContractWithoutProvider<InstanceType> {
  constructor(
    public truffleDefinition: ITruffleDefinition,
    public address: string
  ) {}

  withProvider(provider: Web3.Provider): InstanceType {
    const contract = loadTruffleContract<InstanceType>(this.truffleDefinition)
    contract.setProvider(provider)
    return contract.at(this.address)
  }
}

/**
 * We can't reach directly into the env since the 'environment config' is different
 * depending on whether we are client side or server side. Therefore, the file using
 * one of the contracts below should import the respective load function and pass in the
 * address
 */
export function loadAccountRegistryLogic(address: string) {
  return new ContractWithoutProvider<AccountRegistryLogicInstance>(
    require('@shared/contracts/AccountRegistryLogic.json'),
    address
  )
}

export function loadTokenEscrowMarketplace(address: string) {
  return new ContractWithoutProvider<TokenEscrowMarketplaceInstance>(
    require('@shared/contracts/TokenEscrowMarketplace.json'),
    address
  )
}

export function loadAttestationLogic(address: string) {
  return new ContractWithoutProvider<AttestationLogicInstance>(
    require('@shared/contracts/AttestationLogic.json'),
    address
  )
}

export function loadBatchAttestationLogic(address: string) {
  return new ContractWithoutProvider<BatchAttestationLogicInstance>(
    require('@shared/contracts/BatchAttestationLogic.json'),
    address
  )
}

export function loadVotingCenter(address: string) {
  return new ContractWithoutProvider<VotingCenterInstance>(
    require('@shared/contracts/VotingCenter.json'),
    address
  )
}

export function loadPoll(address: string) {
  return new ContractWithoutProvider<PollInstance>(
    require('@shared/contracts/Poll.json'),
    address
  )
}

export function loadAirdropProxy(address: string) {
  return new ContractWithoutProvider<AirdropProxyInstance>(
    require('@shared/contracts/AirdropProxy.json'),
    address
  )
}
