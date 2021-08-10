import { CommandBase } from '../../types'
import { CommandExample, ReturnCode } from '../../types/command'
import { initDocs } from './initDocs'

const syntax = 'doc init'
const aliases = ['docs']
const usage = 'sasjs docs init'
const description =
  'Initialises doxygen configuration for existing SASjs projects. Can also be used to reset the configuration and content.'
const examples: CommandExample[] = [
  {
    command: 'sasjs doc init',
    description: ''
  }
]

export class InitDocsCommand extends CommandBase {
  constructor(args: string[]) {
    super(args, {
      usage,
      description,
      examples,
      syntax,
      aliases
    })
  }

  public async execute() {
    const returnCode = await initDocs()
      .then(() => {
        process.logger?.success(
          'The doxygen configuration files have been initialised under `/sasjs/doxy/`. You can now run `sasjs doc`.'
        )
        return ReturnCode.Success
      })
      .catch((err) => {
        process.logger?.error('Error initialising docs: ', err)
        return ReturnCode.InternalError
      })

    return returnCode
  }
}
