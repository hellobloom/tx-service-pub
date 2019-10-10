import * as Web3 from 'web3'

import {privateEngine, walletFor} from '@shared/ethereum/customWeb3Provider'
import {env} from '@shared/environment'
import {EContractNames} from '@shared/tx/method_manifest'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'

// const engine = privateEngine(env.owner.ethPrivKey)
// const wallet = walletFor(env.owner.ethPrivKey)

// export const address = wallet.getAddressString()
// export const web3 = new Web3(engine)
//
export const infoByContractAndNetwork = async (
  contract_name: EContractNames,
  network: ENetworks
) => {
  let e = await env()
  let cn = e.admins[contract_name]
  if (!cn) {
    throw new Error(`Couldn't find contract name in env.admins: ${contract_name}`)
  }
  let details = cn['all'] || cn[network]
  if (!details) {
    throw new Error(
      `Couldn't find network for contract in env.admins: ${contract_name}, ${network}`
    )
  }
  return details
}

export const keyByContractAndNetwork = async (
  contract_name: EContractNames,
  network: ENetworks
) => {
  let details = await infoByContractAndNetwork(contract_name, network)
  return details.admin_key
}

export const engineByContractAndNetwork = async (
  contract_name: EContractNames,
  network: ENetworks
) => {
  return privateEngine(await keyByContractAndNetwork(contract_name, network))
}

export const walletByContractAndNetwork = async (
  contract_name: EContractNames,
  network: ENetworks
) => {
  return walletFor(await keyByContractAndNetwork(contract_name, network))
}

export const addressByContractAndNetwork = async (
  contract_name: EContractNames,
  network: ENetworks
) => {
  return (await walletByContractAndNetwork(
    contract_name,
    network
  )).getAddressString()
}

export const web3ByContractAndNetwork = async (
  contract_name: EContractNames,
  network: ENetworks
) => {
  let engine = await engineByContractAndNetwork(contract_name, network)
  return new Web3(engine)
}
