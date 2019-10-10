import {isValidAddress, toBuffer} from 'ethereumjs-util'
const ethSigUtil = require('eth-sig-util')

import {TUnvalidated} from '@shared/params/validation'
import * as U from '@shared/params/utils'
import {getFormattedTypedDataVoteFor} from '@shared/params/signingLogic'
import {genValidateFn} from '@shared/tx/validator'

interface IInvalidParamError {
  kind: 'invalid_param'
  message: string
}

interface ISuccess {
  kind: 'validated'
  data: IVoteForParams
}

export type TValidateAddAddressParamsOutput = IInvalidParamError | ISuccess

export interface IVoteForParams {
  pollName: string
  choice: number
  voter: string
  nonce: number
  pollAddress: string
  delegationSig: string
}

export const validateVoteForSig = (
  delegationSig: string,
  data: TUnvalidated<IVoteForParams>
) => {
  const recoveredETHAddress: string = ethSigUtil.recoverTypedSignature({
    data: getFormattedTypedDataVoteFor(
      data.pollName,
      1,
      data.choice,
      data.voter,
      data.nonce,
      data.pollAddress
    ),
    sig: data.delegationSig,
  })
  return recoveredETHAddress.toLowerCase() === data.voter.toLowerCase()
}

export const validateVoteForParams = genValidateFn([
  ['pollName', U.isNotEmptyString, false],
  ['choice', U.isValidUint16, false],
  ['voter', isValidAddress, false],
  ['voter', U.isNotEmptyString, false],
  ['nonce', U.isNotEmptyString, false],
  ['pollAddress', isValidAddress, false],
  ['pollAddress', U.isNotEmptyString, false],
  ['delegationSig', U.isValidSignatureString, false],
  ['delegationSig', U.isNotEmptyString, false],
  ['delegationSig', validateVoteForSig, true],
])

export const validateBatchAttestdataHash = (
  data: string
) => {
  if(typeof data !== 'string') return false
  const dataHash = toBuffer(data)
  return dataHash.length === 32
}

export const validateBatchAttestParams = genValidateFn([
  ['dataHash', validateBatchAttestdataHash, false],
])
