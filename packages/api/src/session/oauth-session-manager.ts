import { FetchError, OAuthAgent } from '@atproto/oauth-client'
import { XRPCError } from '@atproto/xrpc'
import { SessionManager } from './session-manager'

export class OAuthSessionManager extends SessionManager {
  constructor(readonly agent: OAuthAgent) {
    super()
  }

  async fetchHandler(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.agent.request(url, init)
    } catch (cause) {
      if (cause instanceof FetchError) {
        throw new XRPCError(
          cause.statusCode,
          undefined,
          cause.message,
          cause.response?.headers
            ? Object.fromEntries(cause.response.headers.entries())
            : undefined,
          { cause },
        )
      }
      throw cause
    }
  }

  async getServiceUrl(): Promise<URL> {
    return new URL(this.agent.serverMetadata.issuer)
  }

  get did() {
    return this.agent.sub
  }
}
