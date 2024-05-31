import {
  AccessTokenType,
  OAuthProvider,
  OAuthProviderOptions,
} from '@atproto/oauth-provider'

import { AccountManager } from '../account-manager/index.js'
import { ActorStore } from '../actor-store/index.js'
import { oauthLogger } from '../logger.js'
import { LocalViewerCreator } from '../read-after-write/index.js'
import { DetailedAccountStore } from './detailed-account-store.js'

export type AuthProviderOptions = {
  accountManager: AccountManager
  actorStore: ActorStore
  localViewer: LocalViewerCreator
} & Pick<
  OAuthProviderOptions,
  'issuer' | 'redis' | 'keyset' | 'dpopSecret' | 'customization'
> &
  Required<Pick<OAuthProviderOptions, 'safeFetch'>>

export class PdsOAuthProvider extends OAuthProvider {
  constructor({
    accountManager,
    actorStore,
    localViewer,
    keyset,
    redis,
    dpopSecret,
    issuer,
    customization,
    safeFetch,
  }: AuthProviderOptions) {
    super({
      issuer,
      keyset,
      dpopSecret,
      redis,
      safeFetch,
      customization,

      accountStore: new DetailedAccountStore(
        accountManager,
        actorStore,
        localViewer,
      ),
      requestStore: accountManager,
      deviceStore: accountManager,
      tokenStore: accountManager,

      // If the PDS is both an authorization server & resource server (no
      // entryway), there is no need to use JWTs as access tokens. Instead,
      // the PDS can use tokenId as access tokens. This allows the PDS to
      // always use up-to-date token data from the token store.
      accessTokenType: AccessTokenType.id,

      // TODO: make client client list configurable
      onIsFirstPartyClient: (client) => client.id === 'https://bsky.app/',
    })
  }

  createRouter() {
    return this.httpHandler({
      onError: (req, res, err, message) => oauthLogger.error({ err }, message),
    })
  }
}