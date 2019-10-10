export interface ILogstash {
  host: string
  username: string
  password: string
}

export enum EContractNames {
  'AccountRegistryLogic' = 'AccountRegistryLogic',
  'AccreditationRepo' = 'AccreditationRepo',
  'Address' = 'Address',
  'AirdropProxy' = 'AirdropProxy',
  'AttestationLogic' = 'AttestationLogic',
  'BatchAttestationLogic' = 'BatchAttestationLogic',
  'BatchInitializer' = 'BatchInitializer',
  'DependentOnIPFS' = 'DependentOnIPFS',
  'ECDSA' = 'ECDSA',
  'ERC20' = 'ERC20',
  'BLT' = 'BLT',
  'IERC20' = 'IERC20',
  'Initializable' = 'Initializable',
  'Migrations' = 'Migrations',
  'MockBLT' = 'MockBLT',
  'Ownable' = 'Ownable',
  'Pausable' = 'Pausable',
  'PauserRole' = 'PauserRole',
  'Poll' = 'Poll',
  'Roles' = 'Roles',
  'SafeERC20' = 'SafeERC20',
  'SafeMath' = 'SafeMath',
  'SigningLogic' = 'SigningLogic',
  'TokenEscrowMarketplace' = 'TokenEscrowMarketplace',
  'VotingCenter' = 'VotingCenter',
}

export enum ENetworks {
  'mainnet' = 'mainnet',
  'rinkeby' = 'rinkeby',
  'local' = 'local',
  'kovan' = 'kovan',
  'sokol' = 'sokol',
  'ropsten' = 'ropsten',
  'all' = 'all',
}
export type TProviders = {[P in keyof typeof ENetworks]?: string}

export type TContracts = {
  [P in keyof typeof EContractNames]: {
    [innerP in keyof typeof ENetworks]?: {
      address: string
      admin_key: string
    }
  }
}

export type TWebhookSettings = {
  broadcast: boolean
  mined: boolean
  failed: boolean
}

export enum EAppsFull {
  txService = 'txService',
}
export type TWebhookOut = {
  address: string // outgoing host
  key: string // outgoing key
}

export type TWebhookIn = {
  keySha: string // hash of incoming key
}

export type TWebhookSettingsByApp = {
  [k in keyof typeof EAppsFull]?: TWebhookSettings
}

export type TWebhookDual = TWebhookOut & TWebhookIn

export type TWebhookDualTXS = TWebhookDual & TWebhookSettings

export type TWebhookDualTXSByApp = {[k in keyof typeof EAppsFull]?: TWebhookDualTXS}

export enum ELogLevel {
  'error' = 'error',
  'warn' = 'warn',
  'info' = 'info',
  'verbose' = 'verbose',
  'debug' = 'debug',
  'silly' = 'silly',
}

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
export type TEnvType =
  | 'string'
  | 'json'
  | 'int'
  | 'float'
  | 'bool'
  | 'buffer'
  | 'object'
  | 'enum'

export const testBool = (value: string) =>
  (['true', 't', 'yes', 'y'] as any).includes(value.toLowerCase())

type TBasicJSTypes = 'object' | 'number' | 'string' | 'boolean' | 'undefined'
type TTypeCheckProps = {
  [key: string]: TBasicJSTypes
}

export const toBuffer = (hex: string) => {
  Buffer.from(hex.replace('0x', ''), 'hex')
}

export const checkVar = (
  source: any,
  name: string,
  type: TEnvType = 'string',
  required: boolean = true,
  opts: {
    enum?: any
    default?: any
    props?: TTypeCheckProps
  } = {}
): any => {
  var valid = false
  var val = source[name]
  if (['json'].indexOf(type) !== -1) {
    throw new Error(
      `JSON values should already be interpreted before reaching the client`
    )
  }
  if (!val) {
    if (required) {
      throw new Error(`Expected environment variable ${name}`)
    } else {
      if (typeof opts.default !== 'undefined') {
        return opts.default
      } else {
        if (type === 'bool') {
          return false
        } else {
          return undefined
        }
      }
    }
  }
  switch (type) {
    case 'string':
      valid = typeof val === 'string'
      break
    case 'object':
      valid = typeof val === 'object'
      if (opts && opts.props) {
        Object.keys(opts.props).forEach((prop: string) => {
          let props = opts.props
          if (typeof props === 'undefined') {
            console.log(`Failed: props undefined`)
            valid = false
            return
          }
          let propType = props[prop]
          if (typeof val[prop] !== propType) {
            console.log(
              `Failed: ${
                val[prop]
              } =/= ${propType} for prop ${prop} in ${JSON.stringify(val)}`
            )
            valid = false
            return
          }
        })
      }
      break
    case 'int':
      valid = (Number as any).isInteger(val)
      break
    case 'float':
      valid = typeof val === 'number' // Best test JS gives I think
      break
    case 'bool':
      valid = typeof val === 'boolean'
      break
    case 'buffer':
      valid = typeof val === 'string' && val.indexOf('0x') === 0
      val = toBuffer(val)
      break
    case 'enum':
      valid = opts && opts.enum && opts.enum.includes(val)
      break
    default:
      throw new Error(`Unsupported env var type: ${type}`)
  }
  if (!valid) {
    throw new Error(
      `Var ${name} failed env var validating.  Value: ${JSON.stringify(
        source[name]
      )}, type: ${type}, required: ${required}`
    )
  } else {
    return val
  }
}

export const envVar = (
  source: any,
  name: string,
  type: TEnvType = 'string',
  required: boolean = true,
  opts: {
    default?: any
    enum?: any
    baseToParseInto?: number
  } = {}
): any => {
  const val = source[name]
  if (['buffer', 'object'].indexOf(type) !== -1) {
    throw new Error(
      `Env var type ${type} specified, but is only allowed for env service clients`
    )
  }
  if (typeof val === 'undefined') {
    if (required) {
      throw new Error(`Expected environment variable ${name}`)
    } else {
      if (typeof opts.default !== 'undefined') {
        return opts.default
      } else {
        if (type === 'bool') {
          return false
        }
      }
    }
  }
  switch (type) {
    case 'string':
      return val
    case 'json':
      try {
        return JSON.parse(val)
      } catch (err) {
        console.log(`JSON failed to parse: ${name}, ${val}`)
        return {} // Fail somewhat gracefully
      }
    case 'int':
      return parseInt(val, opts && opts.baseToParseInto)
    case 'float':
      return parseFloat(val)
    case 'bool':
      return testBool(val)
    case 'enum':
      if (!opts || !opts.enum) {
        throw new Error(`Enum env var has no specified enum`)
      }
      if (!opts.enum.includes(val)) {
        throw new Error(`Value specified for enum env var not contained in enum`)
      }
      return val
    default:
      throw new Error(`unsupported type: ${type}`)
  }
}
