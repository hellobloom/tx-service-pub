import {isString} from 'lodash'
import * as EthU from 'ethereumjs-util'
import * as BigNumber from 'bignumber.js'

const isNotEmpty = (value: string) => value.replace(/\s+/g, '') !== ''
export const isNotEmptyString = (value: any) => isString(value) && isNotEmpty(value)

export const isValidUIntArray = (value: any) =>
  Array.isArray(value) && value.every((v: any) => isValidUint(v))

export const isValidUint = (value: any) => Number.isInteger(value) && value >= 0

export const isValidUint16 = (value: any) => isValidUint(value) && value <= 65535

/**
 * Validate a hex encoded signature string
 *
 * @param signatureString A signature string like "0x123456..."
 */
export const isValidSignatureString = (signatureString: string): boolean => {
  let signature: EthU.Signature
  try {
    signature = EthU.fromRpcSig(signatureString)
  } catch {
    return false
  }
  const {v, r, s} = signature
  return EthU.isValidSignature(v, r, s, true)
}

export const isValidEthHexString = (hexString: string): boolean => {
  return hexString.slice(0, 2) === '0x'
}

export function isBigNumber(input: any): input is BigNumber.BigNumber {
  return input.isBigNumber
}

export function convertToNumber(
  input: string | number | BigNumber.BigNumber
): number {
  if (typeof input === 'number') return input
  else if (typeof input === 'string') return Number(input)
  else if (isBigNumber(input)) return input.toNumber()
  else throw new Error('BloomId must be a number or string or BigNumber')
}

export async function sleep(miliseconds: number) {
  return new Promise(resolve => setTimeout(resolve, miliseconds))
}

export const isNullOrWhiteSpace = (value: any): boolean =>
  typeof value !== 'string' || value.trim() === ''

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export const requiredField = <T>(
  reject: (reason: Error | string) => any,
  data: T
) => (field: string | number | symbol) => {
  if (data[field.toString()] === undefined) {
    reject(new Error(`Missing ${field.toString()}`))
    return false
  }
  return true
}
