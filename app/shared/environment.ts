import {EContractNames} from '@shared/tx/method_manifest'
import {ENetworks} from '@shared/ethereum/customWeb3Provider'
import {
  envVar,
  checkVar,
  ELogLevel,
  EAppsFull,
  TContracts,
  TProviders,
  TWebhookDual,
  ILogstash,
} from './envUtils'
const vault = require('node-vault')

export const retrieveEnv = async (): Promise<IEnvTxService> => {
  try {
    let conf = JSON.parse(process.env.EVAULT_CONFIG!)
    const options = {
      apiVersion: 'v1',
      endpoint: conf.host,
    }
    const vaultInstance = vault(options)
    await vaultInstance.userpassLogin({
      username: conf.username,
      password: conf.password,
    })
    let envResp = await vaultInstance.read(conf.secret_path)
    return envResp.data.data
  } catch (err) {
    console.log(`Env retrieval from evault failed`, err)
    throw err
  }
}

export enum PipelineStages {
  development = 'development',
  ci = 'ci',
  staging = 'staging',
  production = 'production',
  review = 'review',
}

var persistedEnv: undefined | IEnvTxServiceExt

export type TWebhookSettings = {
  broadcast: boolean
  mined: boolean
  failed: boolean
}

export type TWebhookSettingsByApp = {
  [k in keyof typeof EAppsFull]?: TWebhookSettings
}

export type TWebhookDualTXS = TWebhookDual & TWebhookSettings

export type TWebhookDualTXSByApp = {[k in keyof typeof EAppsFull]?: TWebhookDualTXS}

export interface IEnvTxService {
  sentryDSN: string
  logstash?: ILogstash
  jobExpiry: Object
  jobInterval: Object
  maxGasPrice?: string
  admins: Partial<TContracts>
  webhooks: TWebhookDualTXSByApp
  workers: Object
  providers: TProviders
  providerTimeout: number
  log: {
    level: keyof typeof ELogLevel
  }
}

interface IEnvTxServiceExt extends IEnvTxService {
  dbUrl: string
  nodeEnv: string
  appId: string
  disableWorker: boolean
  pipelineStage: PipelineStages
  sourceVersion: string
}

export var env = async (refresh = false): Promise<IEnvTxServiceExt> => {
  if (persistedEnv && !refresh) return persistedEnv
  try {
    var e
    if (process.env.STATIC_ENV_OBJ) {
      e = JSON.parse(process.env.STATIC_ENV_OBJ)
    } else {
      e = (await retrieveEnv()) as IEnvTxService
    }
    const pr = process.env

    const localEnv = {
      dbUrl: envVar(pr, 'PG_URL', 'string'),
      nodeEnv: envVar(pr, 'NODE_ENV', 'string'),
      appId: envVar(pr, 'APP_ID', 'string'),
      disableWorker: envVar(pr, 'DISABLE_WORKER', 'bool', false),
      sourceVersion: envVar(pr, 'SOURCE_VERSION', 'bool', false, {
        default: 'Unspecified',
      }),
      pipelineStage: envVar(pr, 'PIPELINE_STAGE', 'enum', true, {
        enum: Object.keys(PipelineStages),
      }),
    }

    var override
    try {
      if (process.env.ENV_OVERRIDE) {
        override = JSON.parse(process.env.ENV_OVERRIDE)
      }
    } catch (err) {
      console.log('Failed parsing override var', err)
    }
    override = override || {}

    const config: IEnvTxServiceExt = Object.assign(
      e,
      {
        sentryDSN: checkVar(e, 'sentryDSN'),
        logstash: checkVar(e, 'logstash', 'object', false, {
          props: {
            host: 'string',
            username: 'string',
            password: 'string',
          },
        }),
        jobExpiry: checkVar(e, 'jobExpiry', 'object', true),
        jobInterval: checkVar(e, 'jobInterval', 'object', true),
        maxGasPrice: checkVar(e, 'maxGasPrice', 'string', false),
        admins: checkVar(e, 'admins', 'object'),

        webhooks: checkVar(e, 'webhooks', 'object', true),
        workers: checkVar(e, 'workers', 'object', true),
        providers: checkVar(e, 'providers', 'object'),
        providerTimeout: checkVar(e, 'providerTimeout', 'int'),

        log: checkVar(e, 'log', 'object', true, {
          props: {
            level: 'string',
          },
        }),
      },
      localEnv,
      override
    )

    persistedEnv = config

    return config
  } catch (err) {
    console.log('Error resolving environment config', err)
    throw err
  }
}

export const contractObjByContractAndNetwork = (
  envConf: IEnvTxService,
  contract: keyof typeof EContractNames,
  network: keyof typeof ENetworks = 'mainnet'
) => {
  let cmobj = envConf.admins[contract]
  if (!cmobj) {
    throw new Error(
      `Couldn't find contract obj for ${contract}, ${network}: ${cmobj}`
    )
  }
  let networkObj = cmobj['all'] || cmobj[network]
  if (!networkObj) {
    throw new Error(
      `Couldn't find contract obj for ${contract}, ${network}: ${cmobj}`
    )
  }
  return networkObj
}

export const getContractAdminKey = async (
  contract: keyof typeof EContractNames,
  network: keyof typeof ENetworks = 'mainnet'
) => {
  return contractObjByContractAndNetwork(await env(), contract, network).admin_key
}

export const getContractAddr = async (
  contract: keyof typeof EContractNames,
  network: keyof typeof ENetworks = 'mainnet'
) => {
  const allEnv = await env()
  var addr = contractObjByContractAndNetwork(allEnv, contract, network).address
  console.log('Got contract addr', network, contract, addr)
  return addr
}

export const getProvider = async (network: keyof typeof ENetworks = 'mainnet') => {
  let e = await env()
  return e.providers.all || e.providers[network]
}

/* 
// dotenv.config()

interface IEnvironmentConfig {
  appPort: number
  apiKey: string
  dbUrl: string
  nodeEnv: string
  sentryDSN: string
  logLevel?: string
  jobExpiry?: object
  jobInterval?: object
  maxGasPrice: string
  providers: {[P in keyof typeof ENetworks]: string}
  admins: {
    [P in keyof typeof EContractNames]: {
      [P in keyof typeof ENetworks]: {
        admin_key: string
        address: string
      }
    }
  }
  providerTimeout: number
  webhooks: {
    [key: string]: TWebhook
  }
  disableWorker: boolean
  workers: {[P in keyof typeof EJobNames]: boolean}
}

type TEnvType = 'string' | 'json' | 'int' | 'float' | 'bool' | 'buffer' | 'bn'

const testBool = (value: string) =>
  (['true', 't', 'yes', 'y'] as any).includes(value.toLowerCase())

// Throw an error if the specified environment variable is not defined
const envVar = (
  name: string,
  type: TEnvType = 'string',
  required: boolean = true,
  defaultVal?: any,
  opts?: {
    baseToParseInto?: number
  }
): any => {
  const value = process.env[name]
  if (required) {
    if (!value) {
      throw new Error(`Expected environment variable ${name}`)
    }
    switch (type) {
      case 'string':
        return value
      case 'json':
        return JSON.parse(value)
      case 'int':
        return parseInt(value, opts && opts.baseToParseInto)
      case 'float':
        return parseFloat(value)
      case 'bool':
        return testBool(value)
      case 'buffer':
        return toBuffer(value)
      case 'bn':
        return new bn(value)
      default:
        throw new Error(`unsupported type: ${type}`)
    }
  } else {
    if (!value && typeof defaultVal !== 'undefined') return defaultVal
    switch (type) {
      case 'string':
        return value
      case 'json':
        return value && JSON.parse(value)
      case 'int':
        return value && parseInt(value)
      case 'bool':
        return value ? testBool(value) : false
      case 'buffer':
        return value && toBuffer(value)
      case 'bn':
        return value && new bn(value)
      default:
        throw new Error(`unsupported type: ${type}`)
    }
  }
}

export const env: IEnvironmentConfig = {
  appPort: envVar('PORT', 'int', false, 5000),
  apiKey: envVar('API_KEY_SHA256'),
  dbUrl: envVar('PG_URL'),
  nodeEnv: envVar('NODE_ENV'),
  providers: envVar('PROVIDERS', 'json'),
  admins: envVar('ADMINS', 'json'),
  sentryDSN: envVar('SENTRY_DSN'),
  logLevel: envVar('LOG_LEVEL', 'string', false),
  jobExpiry: envVar('JOB_EXPIRY'),
  jobInterval: envVar('JOB_INTERVAL'),
  maxGasPrice: envVar('MAX_GAS_PRICE'),
  webhooks: envVar('WEBHOOKS', 'json'),
  disableWorker: envVar('DISABLE_WORKER', 'bool', false),
  workers: envVar('WORKERS', 'json'),
  providerTimeout: envVar('PROVIDER_TIMEOUT', 'int'),
}

*/
