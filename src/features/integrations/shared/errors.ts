export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotImplementedError'
  }
}

export type ConnectorNotReadyErrorMeta = {
  type: string
  name: string
  docsUrl?: string
}

export class ConnectorNotReadyError extends NotImplementedError {
  readonly connector: ConnectorNotReadyErrorMeta

  constructor(message: string, meta: ConnectorNotReadyErrorMeta) {
    super(message)
    this.name = 'ConnectorNotReadyError'
    this.connector = meta
  }
}
