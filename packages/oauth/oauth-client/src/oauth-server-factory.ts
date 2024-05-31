import { GlobalFetch } from '@atproto-labs/fetch'
import { Key, Keyset } from '@atproto/jwk'
import { OAuthServerMetadata } from '@atproto/oauth-types'

import { Runtime } from './runtime.js'
import { OAuthResolver } from './oauth-resolver.js'
import { DpopNonceCache, OAuthServerAgent } from './oauth-server-agent.js'
import { MetadataResolveOptions } from './oauth-server-metadata-resolver.js'
import { OAuthClientMetadataId } from './types.js'

export class OAuthServerFactory {
  constructor(
    readonly clientMetadata: OAuthClientMetadataId,
    readonly runtime: Runtime,
    readonly resolver: OAuthResolver,
    readonly fetch: GlobalFetch,
    readonly keyset: Keyset | undefined,
    readonly dpopNonceCache: DpopNonceCache,
  ) {}

  async fromIssuer(
    issuer: string,
    dpopKey: Key,
    options?: MetadataResolveOptions,
  ) {
    const serverMetadata = await this.resolver.resolveMetadata(issuer, options)
    return this.fromMetadata(serverMetadata, dpopKey)
  }

  async fromMetadata(serverMetadata: OAuthServerMetadata, dpopKey: Key) {
    return new OAuthServerAgent(
      dpopKey,
      serverMetadata,
      this.clientMetadata,
      this.dpopNonceCache,
      this.resolver,
      this.runtime,
      this.keyset,
      this.fetch,
    )
  }
}
