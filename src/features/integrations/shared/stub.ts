import type { CMSConnector } from './interface'
import { ConnectorNotReadyError } from './errors'

type StubOptions = {
  supportsTest?: boolean
  docsUrl?: string
}

export function createStubConnector(type: string, name: string, options: StubOptions = {}): CMSConnector {
  const suffix = options.docsUrl ? ` — see ${options.docsUrl}` : ''
  const meta = { type, name, docsUrl: options.docsUrl }
  const publishMessage = `[${type}] publish not implemented${suffix}`
  const testMessage = `[${type}] test not implemented${suffix}`

  const connector: CMSConnector = {
    name,
    type,
    async publish() {
      throw new ConnectorNotReadyError(publishMessage, meta)
    }
  }

  if (options.supportsTest) {
    connector.test = async () => {
      throw new ConnectorNotReadyError(testMessage, meta)
    }
  }

  return connector
}
