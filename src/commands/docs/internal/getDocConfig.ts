import { Target, Configuration } from '@sasjs/utils/types'
import { findTargetInConfiguration } from '../../../utils/config'
import { TargetScope } from '../../../types/targetScope'

/**
 * Returns doc related config from root-level and Target-specfic(having precedence)
 * @param {Configuration} config- from which doc related config will be extracted
 * @param {string} targetName- the name of the target for doc config.
 * @param {string} outDirectory- the name of the output folder, provided using command.
 */
export async function getDocConfig(
  config: Configuration,
  targetName: string,
  outDirectory: string
) {
  const { buildDestinationDocsFolder } = process.sasjsConstants

  let target: Target = {} as Target
  try {
    target = (await findTargetInConfiguration(targetName, TargetScope.Local))
      .target
  } catch (error) {}

  if (!outDirectory) {
    outDirectory = config?.docConfig?.outDirectory || buildDestinationDocsFolder
    outDirectory = target?.docConfig?.outDirectory || outDirectory
  }

  let serverUrl = ''
  serverUrl = config?.docConfig?.dataControllerUrl
    ? config.docConfig.dataControllerUrl.split('#')[0] + '#/view/viewer/'
    : ''
  serverUrl = target?.docConfig?.dataControllerUrl
    ? target.docConfig.dataControllerUrl.split('#')[0] + '#/view/viewer/'
    : serverUrl

  const enableLineage: boolean =
    target.docConfig?.enableLineage ?? config.docConfig?.enableLineage ?? true

  const doxyContent = {
    ...config?.docConfig?.doxyContent,
    ...target?.docConfig?.doxyContent
  }

  return {
    target,
    serverUrl,
    newOutDirectory: outDirectory,
    enableLineage,
    doxyContent
  }
}
