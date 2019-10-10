import * as Web3 from 'web3'
import {toBuffer} from 'ethereumjs-util'
import * as ethereumjsWallet from 'ethereumjs-wallet'
const ProviderEngine = require('web3-provider-engine')
const FiltersSubprovider = require('web3-provider-engine/subproviders/filters')
const WalletSubprovider = require('web3-provider-engine/subproviders/wallet')
const Web3Subprovider = require('web3-provider-engine/subproviders/web3')
// import {UserTx} from '@shared/models/index'
import {getProvider} from '@shared/environment'
import SendTransactionHookProvider from '@shared/SendTransactionHookProvider'
import {log} from '@shared/logger'

export type TNetworks =
  | 'mainnet'
  | 'rinkeby'
  | 'local'
  | 'kovan'
  | 'sokol'
  | 'ropsten'
  | 'all'

export enum ENetworks {
  'mainnet' = 'mainnet',
  'rinkeby' = 'rinkeby',
  'local' = 'local',
  'kovan' = 'kovan',
  'sokol' = 'sokol',
  'ropsten' = 'ropsten',
  'all' = 'all',
}

/**
 * Create an ethereumjs-wallet object from a hex encoded string private key
 *
 * @param privateKey Private key string we want to create a wallet from
 */
export const walletFor = (privateKey: string) =>
  ethereumjsWallet.fromPrivateKey(toBuffer(privateKey))

/**
 * Compose our own web3 provider so that we can configure the clients to use
 * a private key we already have.
 *
 * @param privateKey Private key we want to import into our engine
 *
 * @see https://yohanes.gultom.me/configure-truffle-to-use-infura-io-and-existing-private-key/
 * @see https://git.io/vb5x3 Composable provider engines
 */

export interface IWithPrivateEngineResult<T> {
  txData: string[]
  result: T
}

export async function withPrivateEngine<T>(
  privateKey: string,
  options: {stage: TNetworks} = {stage: 'mainnet'},
  callback: (engine: any) => Promise<T>
): Promise<IWithPrivateEngineResult<T>> {
  const engine = new ProviderEngine()

  /**
   * Adds a callback to be called each time a transaction is sent
   *
   */
  var txData: string[] = []

  engine.addProvider(
    new SendTransactionHookProvider(
      options.stage === 'mainnet' ? 1 : 4,
      async tx => {
        try {
          if (tx.data) txData.push(tx.data)
        } catch (error) {
          // need to manually log errors here because the hook gets called
          // async after the tx is sent and isnt awaited
          log(
            {
              error: error,
              details: {
                tags: {logger: 'private-engine', label: 'link-to-user'},
              },
            },
            {full: true}
          )
          throw error
        }
      }
    )
  )

  /**
   * The WalletSubprovider exposes functionality for signing a transaction. This lets
   * us actually use our own private keys.
   */
  engine.addProvider(new WalletSubprovider(walletFor(privateKey), {}))

  /**
   * Add a web3 subprovider which gives us the bare minimum functionality for actually
   * creating, sending, and handling web requests
   */
  const httpProvider = new Web3.providers.HttpProvider(
    await getProvider(options.stage)
  )
  log(['Using provider in WPE', httpProvider])
  engine.addProvider(new Web3Subprovider(httpProvider))
  // engine.addProvider(new Web3Subprovider(getProviderFromStage(options.stage)))

  /**
   * Tell the engine it can start polling our provider to get the current block number.
   * The engine doesn't know if it is setup properly until it observes at least one
   * block from the provider
   *
   * @see https://git.io/vb5xa
   */
  engine.start((err: any) => {
    if (err) {
      log(
        {
          error: err,
          details: {
            tags: {logger: 'private-engine', label: 'start-engine'},
          },
        },
        {full: true}
      )
    }
  })

  try {
    return {txData, result: await callback(engine)}
  } finally {
    engine.stop()
  }
}

export async function withReadOnlyEngine<T>(
  options: {stage: TNetworks} = {stage: 'mainnet'},
  callback: (engine: any) => Promise<T>
) {
  const engine = new ProviderEngine()

  /**
   * Add support for "filtering" calls within the web3 protocol which allows
   * us to query for events and add constraints like the starting block, ending block,
   * and ETH address that created the events.
   */
  engine.addProvider(new FiltersSubprovider())

  /**
   * Add a web3 subprovider which gives us the bare minimum functionality for actually
   * creating, sending, and handling web requests
   */

  let provider = await getProvider(options.stage)

  log(['Using provider in WROE', provider])

  const httpProvider = new Web3.providers.HttpProvider(provider)
  engine.addProvider(new Web3Subprovider(httpProvider))

  // const providerAddr = getProviderFromStage(options.stage)
  // log(['Using HTTP provider', providerAddr, options.stage])
  // const httpProvider = getHttpProvider(getProviderFromStage(options.stage))
  // engine.addProvider(new Web3Subprovider(httpProvider))

  /**
   * Tell the engine it can start polling our provider to get the current block number.
   * The engine doesn't know if it is setup properly until it observes at least one
   * block from the provider
   *
   * @see https://git.io/vb5xa
   */

  engine.start((err: any) => {
    if (err) {
      log(
        {
          error: err,
          details: {
            tags: {logger: 'private-engine', label: 'start-engine'},
          },
        },
        {full: true}
      )
    }
  })

  let result
  try {
    result = await callback(engine)
  } finally {
    engine.stop()
  }

  return result
}

export const privateEngine = async (
  privateKey: string,
  options: {stage: TNetworks} = {stage: 'mainnet'}
): Promise<Web3.Provider> => {
  const engine = new ProviderEngine()

  /**
   * The WalletSubprovider exposes functionality for signing a transaction. This lets
   * us actually use our own private keys.
   */
  engine.addProvider(new WalletSubprovider(walletFor(privateKey), {}))

  /**
   * Add a web3 subprovider which gives us the bare minimum functionality for actually
   * creating, sending, and handling web requests
   */
  const httpProvider = new Web3.providers.HttpProvider(
    await getProvider(options.stage)
  )
  engine.addProvider(new Web3Subprovider(httpProvider))

  /**
   * Tell the engine it can start polling our provider to get the current block number.
   * The engine doesn't know if it is setup properly until it observes at least one
   * block from the provider
   *
   * @see https://git.io/vb5xa
   */
  engine.start()

  return engine
}
