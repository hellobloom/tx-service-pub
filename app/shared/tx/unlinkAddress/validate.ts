import {isValidAddress} from 'ethereumjs-util'
import {genValidateFn} from '@shared/tx/validator'
import * as U from '@shared/params/utils'
const ethSigUtil = require('eth-sig-util')
import {TUnvalidated} from '@shared/params/validation'
import { getFormattedTypedDataRemoveAddress } from '@shared/params/signingLogic'

export interface IUnlinkAddressParams {
  contractAddress: string
  addressToRemove: string
  unlinkSig: string
  nonce: string
}

export const validateDelegationSig = (
  delegationSig: string,
  data: TUnvalidated<IUnlinkAddressParams>
) => {
  const recoveredETHAddress: string = ethSigUtil.recoverTypedSignature({
    data: getFormattedTypedDataRemoveAddress(
      data.contractAddress,
      1,
      data.addressToRemove,
      data.nonce,
    ),
    sig: data.unlinkSig,
  })
  return recoveredETHAddress.toLowerCase() === data.addressToRemove.toLowerCase()
}

export const validateRemoveAddressFromAccountForParams = genValidateFn([
  ['contractAddress', isValidAddress, false],
  ['contractAddress', U.isNotEmptyString, false],
  ['addressToRemove', isValidAddress, false],
  ['addressToRemove', U.isNotEmptyString, false],
  ['nonce', U.isNotEmptyString, false],
  ['delegationSig', validateDelegationSig, true],
])
