import {isValidAddress} from 'ethereumjs-util'
import {genValidateFn} from '@shared/tx/validator'
import {TUnvalidated} from '@shared/params/validation'
import * as U from '@shared/params/utils'
import {
  getFormattedTypedDataAttestFor,
  getFormattedTypedDataPayTokens,
  getFormattedTypedDataAttestationRequest,
} from '@shared/params/signingLogic'
const ethSigUtil = require('eth-sig-util')

interface IInvalidParamError {
  kind: 'invalid_param'
  message: string
}

interface ISuccess {
  kind: 'validated'
  data: IAttestForParams
}

export type TValidateAddAddressParamsOutput = IInvalidParamError | ISuccess

export interface IAttestForParams {
  attestationId: string
  subject: string
  attester: string
  requester: string
  reward: string
  requesterSig: string
  dataHash: string
  requestNonce: string
  subjectSig: string
  attestationLogicAddress: string
  tokenEscrowMarketplaceAddress: string
  delegationSig: string
}

export const validateDelegationSig = (
  delegationSig: string,
  data: TUnvalidated<IAttestForParams>
) => {
  const recoveredETHAddress: string = ethSigUtil.recoverTypedSignature({
    data: getFormattedTypedDataAttestFor(
      data.attestationLogicAddress,
      1,
      data.subject,
      data.requester,
      data.reward,
      data.dataHash,
      data.requestNonce
    ),
    sig: data.delegationSig,
  })
  return recoveredETHAddress.toLowerCase() === data.attester.toLowerCase()
}

export const validateRequesterSig = (
  requesterSig: string,
  data: TUnvalidated<IAttestForParams>
) => {
  // if no reward requesterSig does not need to be checked
  if (data.reward === '0') return true
  const recoveredETHAddress: string = ethSigUtil.recoverTypedSignature({
    data: getFormattedTypedDataPayTokens(
      data.tokenEscrowMarketplaceAddress,
      1,
      data.requester,
      data.attester,
      data.reward,
      data.requestNonce
    ),
    sig: data.delegationSig,
  })
  return recoveredETHAddress.toLowerCase() === data.requester.toLowerCase()
}

export const validateSubjectSig = (
  subjectSig: string,
  data: TUnvalidated<IAttestForParams>
) => {
  const recoveredETHAddress: string = ethSigUtil.recoverTypedSignature({
    data: getFormattedTypedDataAttestationRequest(
      data.attestationLogicAddress,
      1,
      data.dataHash,
      data.requestNonce
    ),
    sig: data.delegationSig,
  })
  return recoveredETHAddress.toLowerCase() === data.subject.toLowerCase()
}

export const validateAttestForParams = genValidateFn([
  ['subject', isValidAddress, false],
  ['subject', U.isNotEmptyString, false],
  ['attester', isValidAddress, false],
  ['attester', U.isNotEmptyString, false],
  ['requester', isValidAddress, false],
  ['requester', U.isNotEmptyString, false],
  ['reward', U.isNotEmptyString, false],
  ['requesterSig', U.isValidEthHexString, false],
  ['requesterSig', U.isNotEmptyString, false],
  ['requesterSig', validateRequesterSig, true],
  ['dataHash', U.isNotEmptyString, false],
  ['dataHash', U.isValidEthHexString, false],
  ['requestNonce', U.isNotEmptyString, false],
  ['requestNonce', U.isValidEthHexString, false],
  ['subjectSig', U.isValidSignatureString, false],
  ['subjectSig', U.isNotEmptyString, false],
  ['subjectSig', validateSubjectSig, true],
  ['delegationSig', U.isValidSignatureString, false],
  ['delegationSig', U.isNotEmptyString, false],
  ['delegationSig', validateDelegationSig, true],
])
