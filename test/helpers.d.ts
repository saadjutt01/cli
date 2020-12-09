import { Target } from '@sasjs/utils/types'

interface GetAuthCodeInput {
  serverUrl: string
  clientId: string
  username: string
  password: string
}

interface VerifyCreateStepInput {
  parentFolderName: string
  appType?: string
}

interface VerifyBuildStepInput {
  parentFolderName: string
  step: string
}

declare function browserGetAuthorizationCode(
  input: GetAuthCodeInput
): Promise<string>

declare function verifyCreate(input: VerifyCreateStepInput): Promise<any>
declare function verifyCreateWeb(input: VerifyCreateStepInput): Promise<any>
declare function verifyStep(input: VerifyBuildStepInput): Promise<any>
declare function addToGlobalConfigs(input: Target): Promise<any>
declare function removeFromGlobalConfigs(input: string): Promise<any>
