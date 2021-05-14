import SASjs from '@sasjs/adapter/node'
import { getConstants } from '../constants'
import { Configuration, Target, TargetJson } from '@sasjs/utils/types'
import { readFile, folderExists, createFile, fileExists } from './file'
import { isAccessTokenExpiring, getNewAccessToken, refreshTokens } from './auth'
import path from 'path'
import dotenv from 'dotenv'
import { TargetScope } from '../types/targetScope'

/**
 * Returns an object that represents the SASjs CLI configuration in a given file.
 * @param {string} pathToFile - the path to the file in question.
 * @returns {Configuration} configuration object if available.
 */
export async function getConfiguration(
  pathToFile: string
): Promise<Configuration> {
  const config = await readFile(pathToFile).catch(() => null)

  if (config) {
    const configJson = JSON.parse(config)
    return (configJson.config ? configJson.config : configJson) as Configuration
  }

  throw new Error(`No configuration was found at path ${pathToFile} .`)
}

/**
 * Returns the target with the given name.
 * If the target is not found in the local configuration,
 * this function then looks in the global configuration.
 * If it is still unable to find it, it throws an error.
 * @param {string} targetName - the name of the target in question.
 * @param {TargetScope} targetScope - if specified will either consider only Local OR only Global targets.
 * @returns {Target} target or fallback when one is found.
 */
export async function findTargetInConfiguration(
  targetName: string,
  targetScope?: TargetScope
): Promise<{ target: Target; isLocal: boolean }> {
  const rootDir = await getProjectRoot()

  if (rootDir !== process.projectDir) {
    process.projectDir = rootDir
  }

  if (targetScope === TargetScope.Local) {
    return targetName
      ? { target: await getLocalTarget(targetName), isLocal: true }
      : {
          target: await getLocalFallbackTarget(),
          isLocal: true
        }
  }

  if (targetScope === TargetScope.Global) {
    return targetName
      ? { target: await getGlobalTarget(targetName), isLocal: false }
      : {
          target: await getGlobalFallbackTarget(),
          isLocal: false
        }
  }

  let target

  if (targetName) {
    try {
      target = await getLocalTarget(targetName)
    } catch (e) {}

    if (target) return { target, isLocal: true }

    try {
      target = await getGlobalTarget(targetName)
    } catch (e) {}

    if (target) return { target, isLocal: false }

    throw new Error(
      `Target \`${targetName}\` was not found.\nPlease check the target name and try again, or use \`sasjs add\` to add a new target.`
    )
  } else {
    try {
      target = await getLocalFallbackTarget()
    } catch (e) {}

    if (target) return { target, isLocal: true }

    try {
      target = await getGlobalFallbackTarget()
    } catch (e) {}

    if (target) return { target, isLocal: false }

    throw new Error(
      `Unable to find any default target.\nPlease check the target name and try again, or use \`sasjs add\` to add a new target.`
    )
  }
}

async function getLocalTarget(targetName: string): Promise<Target> {
  const localConfig = await getConfiguration(
    path.join(process.projectDir, 'sasjs', 'sasjsconfig.json')
  ).catch(() => null)

  if (localConfig?.targets) {
    const targetJson = localConfig.targets.find((t) => t.name === targetName)
    if (targetJson) {
      process.logger?.info(
        `Target ${targetName} was found in your local sasjsconfig.json file.`
      )
      targetJson.allowInsecureRequests = getPrecedenceOfInsecureRequests(
        localConfig,
        targetJson
      )

      return new Target(targetJson)
    }
  }

  throw new Error(
    `Target \`${targetName}\` was not found.\nPlease check the target name and try again, or use \`sasjs add\` to add a new target.`
  )
}
async function getLocalFallbackTarget(): Promise<Target> {
  const localConfig = await getConfiguration(
    path.join(process.projectDir, 'sasjs', 'sasjsconfig.json')
  ).catch(() => null)

  let fallBackTargetJson
  if (localConfig?.targets) {
    const defaultTargetName = localConfig?.defaultTarget
    if (defaultTargetName) {
      fallBackTargetJson = localConfig?.targets?.find(
        (t) => t.name === defaultTargetName
      )
    }

    if (fallBackTargetJson) {
      process.logger?.info(
        `No target was specified. Falling back to default target '${fallBackTargetJson.name}' from your local sasjsconfig.json file.`
      )
      fallBackTargetJson.allowInsecureRequests =
        getPrecedenceOfInsecureRequests(localConfig, fallBackTargetJson)

      return new Target(fallBackTargetJson)
    }
  }
  throw new Error(
    `No target was found.\nPlease check the target name and try again, or use \`sasjs add\` to add a new target.`
  )
}
async function getGlobalTarget(targetName: string): Promise<Target> {
  const globalConfig = await getGlobalRcFile()

  if (globalConfig?.targets) {
    const targetJson = globalConfig.targets.find(
      (t: Target) => t.name === targetName
    )
    if (targetJson) {
      process.logger?.info(
        `Target ${targetName} was found in your global .sasjsrc file.`
      )
      targetJson.allowInsecureRequests = getPrecedenceOfInsecureRequests(
        globalConfig,
        targetJson
      )

      return new Target(targetJson)
    }
  }

  throw new Error(
    `Target \`${targetName}\` was not found.\nPlease check the target name and try again, or use \`sasjs add\` to add a new target.`
  )
}
async function getGlobalFallbackTarget(): Promise<Target> {
  const globalConfig = (await getGlobalRcFile()) as Configuration
  let fallBackTargetJson

  const defaultTargetName = globalConfig?.defaultTarget
  if (defaultTargetName) {
    fallBackTargetJson = globalConfig?.targets?.find(
      (t) => t.name === defaultTargetName
    )
  }

  if (fallBackTargetJson) {
    process.logger?.info(
      `No target was specified. Falling back to default target '${fallBackTargetJson.name}' from your global .sasjsrc file.`
    )
    fallBackTargetJson.allowInsecureRequests = getPrecedenceOfInsecureRequests(
      globalConfig,
      fallBackTargetJson
    )

    return new Target(fallBackTargetJson)
  }

  throw new Error(
    `No target was found.\nPlease check the target name and try again, or use \`sasjs add\` to add a new target.`
  )
}

export async function getGlobalRcFile() {
  const homeDir = require('os').homedir()
  const sasjsRcFileContent = await readFile(
    path.join(homeDir, '.sasjsrc')
  ).catch(() => null)
  return sasjsRcFileContent
    ? JSON.parse(sasjsRcFileContent)
    : sasjsRcFileContent
}

export async function getLocalRcFile() {
  const projectRoot = await getProjectRoot()
  if (!projectRoot) {
    return null
  }
  const config = await getConfiguration(path.join(projectRoot, '.sasjsrc'))
  return config
}

export async function saveGlobalRcFile(content: string) {
  const homeDir = require('os').homedir()
  const rcFilePath = path.join(homeDir, '.sasjsrc')

  await createFile(rcFilePath, content)

  return rcFilePath
}

export async function saveToGlobalConfig(
  target: Target,
  isDefault: boolean = false,
  saveWithDefaultValues: boolean = true
) {
  let globalConfig = await getGlobalRcFile()
  const targetJson = target.toJson(saveWithDefaultValues)
  if (globalConfig) {
    if (globalConfig.targets && globalConfig.targets.length) {
      const existingTargetIndex = globalConfig.targets.findIndex(
        (t: Target) => t.name === target.name
      )
      if (existingTargetIndex > -1) {
        globalConfig.targets[existingTargetIndex] = targetJson
      } else {
        globalConfig.targets.push(targetJson)
      }
    } else {
      globalConfig.targets = [targetJson]
    }
  } else {
    globalConfig = { targets: [targetJson] }
  }

  if (isDefault) {
    globalConfig.defaultTarget = target.name
  }

  return await saveGlobalRcFile(JSON.stringify(globalConfig, null, 2))
}

export async function removeFromGlobalConfig(targetName: string) {
  let globalConfig = (await getGlobalRcFile()) as Configuration
  if (globalConfig && globalConfig.targets && globalConfig.targets.length) {
    const targets = globalConfig.targets.filter((t) => t.name !== targetName)

    if (globalConfig.defaultTarget === targetName) {
      globalConfig.defaultTarget = ''
    }

    await saveGlobalRcFile(
      JSON.stringify({ ...globalConfig, targets }, null, 2)
    )
  }
}

export async function removeFromLocalConfig(targetName: string) {
  let config = (await getLocalConfig()) as Configuration
  if (config && config.targets && config.targets.length) {
    const targets = config.targets.filter((t) => t.name !== targetName)

    if (config.defaultTarget === targetName) {
      config.defaultTarget = ''
    }

    const configPath = path.join(
      process.projectDir,
      'sasjs',
      'sasjsconfig.json'
    )

    await createFile(
      configPath,
      JSON.stringify({ ...config, targets }, null, 2)
    )
  }
}

export async function getLocalConfig() {
  let config = await getConfiguration(
    path.join(process.projectDir, 'sasjs', 'sasjsconfig.json')
  )

  return config
}

export async function getLocalOrGlobalConfig(): Promise<{
  configuration: Configuration
  isLocal: boolean
}> {
  try {
    return { configuration: await getLocalConfig(), isLocal: true }
  } catch (e) {
    return { configuration: await getGlobalRcFile(), isLocal: false }
  }
}

export async function saveLocalConfigFile(content: string) {
  const configPath = path.join(process.projectDir, 'sasjs', 'sasjsconfig.json')

  await createFile(configPath, content)

  return configPath
}

export async function saveToLocalConfig(
  target: Target,
  isDefault: boolean = false,
  saveWithDefaultValues: boolean = true
) {
  const targetJson = target.toJson(saveWithDefaultValues)
  let config = await getLocalConfig()
  if (config) {
    if (config.targets && config.targets.length) {
      const existingTargetIndex = config.targets.findIndex(
        (t) => t.name === target.name
      )
      if (existingTargetIndex > -1) {
        config.targets[existingTargetIndex] = targetJson
      } else {
        config.targets.push(targetJson)
      }
    } else {
      config.targets = [targetJson]
    }
  } else {
    config = { targets: [targetJson] }
  }

  if (isDefault) {
    config.defaultTarget = target.name
  }

  const configPath = path.join(process.projectDir, 'sasjs', 'sasjsconfig.json')

  await createFile(configPath, JSON.stringify(config, null, 2))

  return configPath
}

export async function getFolders() {
  const configPath = '../config.json'
  const config = await readFile(path.join(__dirname, configPath))
  if (config) {
    const configJson = JSON.parse(config)
    return Promise.resolve(configJson.folders)
  }
  return Promise.reject()
}

export async function getSourcePaths(buildSourceFolder: string) {
  const { configuration } = await getLocalOrGlobalConfig()

  const sourcePaths = configuration?.macroFolders
    ? configuration.macroFolders.map((macroPath: string) =>
        path.isAbsolute(macroPath)
          ? macroPath
          : path.join(buildSourceFolder, macroPath)
      )
    : []
  const macroCorePath = await getMacroCorePath()
  sourcePaths.push(macroCorePath)

  return sourcePaths
}

/**
 * Returns SAS program folders from configuration.
 * This list includes both common and target-specific folders.
 * @param {Target} target- the target to check program folders for.
 */
export async function getProgramFolders(target: Target) {
  let programFolders: string[] = []
  const projectRoot = await getProjectRoot()
  const localConfig = await getConfiguration(
    path.join(projectRoot, 'sasjs', 'sasjsconfig.json')
  ).catch(() => null)
  if (localConfig?.programFolders) {
    programFolders = programFolders.concat(localConfig.programFolders)
  }

  if (target?.programFolders) {
    programFolders = programFolders.concat(target.programFolders)
  }

  return programFolders
}

/**
 * Returns SAS macro folders from configuration.
 * This list includes both common and target-specific folders.
 * @param {string} targetName - name of the configuration.
 */
export async function getMacroFolders(targetName: string) {
  let macroFolders: string[] = []

  if (!targetName) return macroFolders

  const projectRoot = await getProjectRoot()
  const localConfig = await getConfiguration(
    path.join(projectRoot, 'sasjs', 'sasjsconfig.json')
  ).catch(() => null)
  if (localConfig?.macroFolders) {
    macroFolders = macroFolders.concat(localConfig.macroFolders)
  }

  const { target } = await findTargetInConfiguration(targetName)

  if (target.macroFolders) {
    macroFolders = macroFolders.concat(target.macroFolders)
  }

  return macroFolders
}

export async function getMacroCorePath() {
  const { macroCorePath } = await getConstants()
  return macroCorePath
}

/**
 * Sanitizes app location string.
 * @param {string} appLoc - app location
 */
export function sanitizeAppLoc(appLoc: string) {
  if (!appLoc || typeof appLoc !== 'string') return

  // Removes trailing '/'
  appLoc = appLoc.replace(/\/{1,}$/, '')

  // Adds leading '/'
  if (!/^\//.test(appLoc)) appLoc = '/' + appLoc

  // Replaces multiple leading '/' with a single '/'
  appLoc = appLoc.replace(/^\/{2,}/, '/')

  return appLoc
}

export async function getProjectRoot() {
  let root = ''
  let rootFound = false
  let i = 1
  let currentLocation = process.projectDir

  const maxLevels = currentLocation.split(path.sep).length

  while (!rootFound && i <= maxLevels) {
    const isRoot =
      (await folderExists(path.join(currentLocation, 'sasjs'))) &&
      (await fileExists(
        path.join(currentLocation, 'sasjs', 'sasjsconfig.json')
      ))

    if (isRoot) {
      rootFound = true
      root = currentLocation

      break
    } else {
      currentLocation = path.join(currentLocation, '..')
      i++
    }
  }

  return root
}

/**
 * Gets an access token for the specified target.
 * If the target is from the global `.sasjsrc` file,
 * the auth info should be contained in it.
 * It should be in the form:
 * @example: { targets: [{ "name": "targetName", "authConfig": { "client": "client ID", "secret": "Client Secret", "access_token": "Token", "refresh_token": "Token" }}]}
 * If the access token is going to expire in the next hour,
 * it is refreshed using a refresh token if available.
 * If a refresh token is unavailable, we will use the client ID and secret
 * to obtain a new access token. Manual intervention is required in this case
 * to navigate to the URL shown and type in an authorization code.
 * @param {object} target - the target to get an access token for.
 * @param {string} checkIfExpiring - flag that indicates whether to do an expiry check.
 */
export async function getAccessToken(target: Target, checkIfExpiring = true) {
  let accessToken =
    target && target.authConfig && target.authConfig.access_token
      ? target.authConfig.access_token
      : ''

  if (
    !accessToken ||
    accessToken.trim() === 'null' ||
    accessToken.trim() === 'undefined'
  ) {
    await overrideEnvVariables(target?.name)
    accessToken = process.env.ACCESS_TOKEN as string
  }

  if (
    !accessToken ||
    accessToken.trim() === 'null' ||
    accessToken.trim() === 'undefined'
  ) {
    throw new Error(
      `A valid access token was not found.\nPlease provide an access token in the access_token property in your .env file or as part of the authInfo in your target configuration (sasjsconfig.json).`
    )
  }

  if (checkIfExpiring && isAccessTokenExpiring(accessToken)) {
    const sasjs = new SASjs({
      serverUrl: target.serverUrl,
      allowInsecureRequests: target.allowInsecureRequests,
      serverType: target.serverType
    })

    let client =
      target.authConfig && target.authConfig.client
        ? target.authConfig.client
        : process.env.CLIENT
    client =
      client && (client.trim() === 'null' || client.trim() === 'undefined')
        ? undefined
        : client

    if (!client) {
      throw new Error(
        `Client ID was not found.
        Please make sure that the 'client' property is set in your local .env file or in the correct target authConfig in your global ~/.sasjsrc file.`
      )
    }

    let secret =
      target.authConfig && target.authConfig.secret
        ? target.authConfig.secret
        : process.env.SECRET
    secret =
      secret && (secret.trim() === 'null' || secret.trim() === 'undefined')
        ? undefined
        : secret

    if (!secret) {
      throw new Error(
        `Client secret was not found.
        Please make sure that the 'secret' property is set in your local .env file or in the correct target authConfig in your global ~/.sasjsrc file.`
      )
    }

    let refreshToken =
      target.authConfig && target.authConfig.refresh_token
        ? target.authConfig.refresh_token
        : process.env.REFRESH_TOKEN
    refreshToken =
      refreshToken &&
      (refreshToken.trim() === 'null' || refreshToken.trim() === 'undefined')
        ? undefined
        : refreshToken

    let authConfig

    if (refreshToken) {
      authConfig = await refreshTokens(sasjs, client, secret, refreshToken)
    } else {
      authConfig = await getNewAccessToken(sasjs, client, secret, target)
    }

    accessToken = authConfig?.access_token
  }

  return accessToken
}

/**
 * Overrides environment variables with values from a target-specific env file if available.
 * Displays a warning if the file is unavailable.
 * @param {string} targetName - the name of the target corresponding to the .env file.
 */
export const overrideEnvVariables = async (targetName: string) => {
  if (!targetName) {
    return
  }
  const targetEnvFile = await readFile(
    path.join(process.projectDir, `.env.${targetName}`)
  ).catch((e) => {
    process.logger?.warn(
      `A .env.${targetName} file was not found in your project directory. Defaulting to variables from the main .env file.`
    )
  })

  if (!targetEnvFile) {
    return
  }

  const targetEnvConfig = dotenv.parse(targetEnvFile)
  for (const k in targetEnvConfig) {
    process.env[k] = targetEnvConfig[k]
  }
}

const getPrecedenceOfInsecureRequests = (
  config: Configuration,
  target: TargetJson
): boolean => {
  return target.allowInsecureRequests ?? !!config.allowInsecureRequests
}
