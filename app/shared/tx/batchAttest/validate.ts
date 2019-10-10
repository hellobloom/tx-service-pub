import {genValidateFn} from '@shared/tx/validator'
import * as U from '@shared/params/utils'

interface IInvalidParamError {
  kind: 'invalid_param'
  message: string
}

interface ISuccess {
  kind: 'validated'
  data: IBatchAttestParams
}

export type TValidateAddAddressParamsOutput = IInvalidParamError | ISuccess

export interface IBatchAttestParams {
  dataHash: string
}

export const validateAttestForParams = genValidateFn([
  ['dataHash', U.isNotEmptyString, false],
  ['dataHash', U.isValidEthHexString, false],
])
