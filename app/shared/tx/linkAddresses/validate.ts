import {isValidAddress} from 'ethereumjs-util'
const ethSigUtil = require('eth-sig-util')

import {TUnvalidated} from '@shared/params/validation'
import * as U from '@shared/params/utils'
import {getFormattedTypedDataAddAddress} from '@shared/params/signingLogic'
import {genValidateFn} from '@shared/tx/validator'

interface IInvalidParamError {
  kind: 'invalid_param'
  message: string
}

interface ISuccess {
  kind: 'validated'
  data: IAddAddressParams
}

export type TValidateAddAddressParamsOutput = IInvalidParamError | ISuccess

export interface IAddAddressParams {
  contractAddress: string
  newAddress: string
  newAddressSig: string
  senderSig: string
  sender: string
  nonce: string
}

export const validateAddAddressSig = (
  contractAddress: string,
  expectedAddress: string,
  signature: string,
  signedAddress: string,
  signedNonce: string
) => {
  const recoveredETHAddress: string = ethSigUtil.recoverTypedSignature({
    data: getFormattedTypedDataAddAddress(contractAddress, 1, signedAddress, signedNonce),
    sig: signature,
  })
  return recoveredETHAddress.toLowerCase() === expectedAddress.toLowerCase()
}

const validateNewAddressSig = (
  subjectSig: string,
  unvalidatedAddAddressParams: TUnvalidated<IAddAddressParams>
) => {
  return validateAddAddressSig(
    unvalidatedAddAddressParams.contractAddress,
    unvalidatedAddAddressParams.newAddress,
    unvalidatedAddAddressParams.newAddressSig,
    unvalidatedAddAddressParams.sender,
    unvalidatedAddAddressParams.nonce
  )
}

const validateSenderSig = (
  subjectSig: string,
  unvalidatedAddAddressParams: TUnvalidated<IAddAddressParams>
) => {
  return validateAddAddressSig(
    unvalidatedAddAddressParams.contractAddress,
    unvalidatedAddAddressParams.sender,
    unvalidatedAddAddressParams.senderSig,
    unvalidatedAddAddressParams.newAddress,
    unvalidatedAddAddressParams.nonce
  )
}

export const validateAddAddressToAccountForParams = genValidateFn([
  ['newAddress', isValidAddress, false],
  ['newAddress', U.isNotEmptyString, false],
  ['newAddressSig', U.isValidSignatureString, false],
  ['newAddressSig', U.isNotEmptyString, false],
  ['newAddressSig', validateNewAddressSig, true],
  ['senderSig', U.isValidSignatureString, false],
  ['senderSig', U.isNotEmptyString, false],
  ['senderSig', validateSenderSig, true],
  ['sender', isValidAddress, false],
  ['sender', U.isNotEmptyString, false],
  ['nonce', U.isNotEmptyString, false],
])
