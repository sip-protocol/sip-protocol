export type NotFoundSubject = 'domain' | 'record'
export type MalformedReason = 'json-parse' | 'schema'

export class NotFound extends Error {
  readonly name = 'NotFound'
  constructor(public readonly subject: NotFoundSubject) {
    super(`Not found: ${subject}`)
  }
}

export class Malformed extends Error {
  readonly name = 'Malformed'
  constructor(
    public readonly reason: MalformedReason,
    public override readonly cause?: unknown,
  ) {
    super(`Malformed record: ${reason}`)
  }
}

export class NetworkError extends Error {
  readonly name = 'NetworkError'
  constructor(message: string, public override readonly cause?: unknown) {
    super(message)
  }
}

export class UserRejected extends Error {
  readonly name = 'UserRejected'
  constructor(message = 'User rejected the signature request') {
    super(message)
  }
}

export class OnChainError extends Error {
  readonly name = 'OnChainError'
  constructor(
    public readonly signature: string,
    message: string,
  ) {
    super(`On-chain error (${signature}): ${message}`)
  }
}
