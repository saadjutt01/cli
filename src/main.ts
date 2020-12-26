import {
  addCredential,
  addTarget,
  build,
  processContext,
  create,
  buildDB,
  deploy,
  folder,
  printHelpText,
  processJob,
  runSasJob,
  runSasCode,
  processServicepack,
  printVersion,
  createWebAppServices,
  processFlow
} from './commands'
import chalk from 'chalk'
import { displayError, displaySuccess } from './utils/displayResult'
import { Command } from './utils/command'
import { compile } from './commands/compile/compile'

export async function createFileStructure(command: Command) {
  const template = command.getFlagValue('template')
  const parentFolderName = command.values.shift()

  return await create(parentFolderName || '.', template)
    .then(() => {
      displaySuccess(
        `Project ${
          parentFolderName ? `${parentFolderName} created` : `updated`
        } successfully.\nGet ready to Unleash your SAS!`
      )
    })
    .catch((err: any) => {
      displayError(err, 'An error has occurred whilst creating your project.')
    })
}

export async function showHelp() {
  await printHelpText()
}

export async function showVersion() {
  await printVersion()
}

export async function buildServices(command: Command) {
  let targetName = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  await build(targetName)
    .then(() => {
      displaySuccess(
        `Services have been successfully built!\nThe build output is located in the ${chalk.cyanBright(
          'sasjsbuild'
        )} directory.`
      )
    })
    .catch((err) => {
      displayError(err, 'An error has occurred when building services.')
    })
}

export async function compileServices(command: Command) {
  let targetName = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  await compile(targetName)
    .then(() => {
      displaySuccess(
        `Services have been successfully compiled!\nThe build output is located in the ${chalk.cyanBright(
          'sasjsbuild'
        )} directory.`
      )
    })
    .catch((err) => {
      displayError(err, 'An error has occurred when building services.')
    })
}

export async function deployServices(command: Command) {
  let targetName = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  await deploy(targetName)
    .then(() => displaySuccess(`Services have been successfully deployed!`))
    .catch((err) => {
      displayError(err, 'An error has occurred when deploying services.')
    })
}

export async function compileBuildServices(command: Command) {
  let targetName = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  await compileServices(command)
  await build(targetName)
    .then(() => {
      displaySuccess(
        `Services have been successfully compiled & built!\nThe build output is located in the ${chalk.cyanBright(
          'sasjsbuild'
        )} directory.`
      )
    })
    .catch((error) => {
      if (Array.isArray(error)) {
        const nodeModulesErrors = error.find((err) =>
          err.includes('node_modules/@sasjs/core')
        )

        if (nodeModulesErrors)
          displaySuccess(
            `Suggestion: @sasjs/core dependency is missing. Try running 'npm install @sasjs/core' command.`
          )
      } else {
        displayError(error, 'An error has occurred when building services.')
      }

      throw error
    })
}

export async function compileBuildDeployServices(command: Command) {
  let targetName = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  await compileServices(command)
  await buildServices(command) // enforcing compile & build & deploy
  await deployServices(command)
}

export async function buildDBs() {
  await buildDB()
    .then(() => {
      displaySuccess(
        `DB have been successfully built!\nThe build output is located in the ${chalk.cyanBright(
          'sasjsbuild/db'
        )} directory.`
      )
    })
    .catch((err) => {
      displayError(err, 'An error has occurred when building DBs.')
    })
}

export async function buildWebApp(command: Command) {
  let targetName: string = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  await createWebAppServices(targetName)
    .then(() =>
      displaySuccess(
        `Web app services have been successfully built!\nThe build output is located in the ${chalk.cyanBright(
          'sasjsbuild'
        )} directory.`
      )
    )
    .catch((err) => {
      displayError(err, 'An error has occurred when building web app services.')
    })
}

export async function add(command: Command) {
  const subCommand = command.getSubCommand()
  let targetName = command.getFlagValue('target')

  if (!targetName) {
    targetName = command.getTargetWithoutFlag()
  }

  if (command && command.name === 'add') {
    if (subCommand === 'cred') {
      await addCredential(targetName)
        .then(() => {
          console.log(chalk.greenBright('Credential successfully added!'))
        })
        .catch((err) => {
          console.log(err)
          displayError(err, 'An error has occurred when adding the credential.')
        })
    } else if (subCommand === 'target' || !subCommand) {
      await addTarget()
        .then(() => {
          console.log(chalk.greenBright('Target successfully added!'))
        })
        .catch((err) => {
          displayError(err, 'An error has occurred when adding the target.')
        })
    }
  }
}

export async function run(command: Command) {
  await runSasCode(command).catch((err) => {
    displayError(err, 'An error has occurred when running your SAS code.')
  })
}

export async function runRequest(command: Command) {
  await runSasJob(command).catch((err) => {
    displayError(err, 'An error has occurred when running your SAS job')
  })
}

export async function context(command: Command) {
  if (!command)
    displayError(null, `Please provide action for the 'context' command.`)

  await processContext(command).catch((err) =>
    displayError(err, 'An error has occurred when processing context.')
  )
}

export async function servicepack(command: Command) {
  if (!command)
    displayError(null, `Please provide action for the 'servicepack' command.`)

  await processServicepack(command).catch((err) =>
    displayError(err, 'An error has occurred when processing servicepack.')
  )
}

export async function folderManagement(command: Command) {
  if (!command)
    displayError(null, `Please provide action for the 'folder' command.`)

  await folder(command).catch((err) => {
    displayError(err, 'An error has occurred when processing folder operation.')
  })
}

export async function jobManagement(command: Command) {
  if (!command)
    displayError(null, `Please provide action for the 'job' command.`)

  await processJob(command).catch((err) => {
    displayError(err, 'An error has occurred when processing job operation.')
  })
}

export async function flowManagement(command: Command) {
  if (!command)
    console.log(
      chalk.redBright(`Please provide action for the 'flow' command.`)
    )

  await processFlow(command).catch((err) => {
    console.log(
      chalk.redBright(
        'An error has occurred when processing flow operation.',
        err
      )
    )
  })
}
