import { BrowserOAuthClient } from '@atproto/oauth-client-browser'
import { useCallback, useState } from 'react'

import LoginForm from './login-form'
import { useOAuth } from './oauth'

/**
 * State data that we want to persist across the OAuth flow, when the user is
 * "logging in".
 */
export type AppState = {
  foo: string
}

const client = new BrowserOAuthClient({
  plcDirectoryUrl: 'http://localhost:2582', // dev-env
  handleResolver: 'http://localhost:2584', // dev-env

  clientMetadata: {
    client_id: 'http://localhost/',
    redirect_uris: ['http://127.0.0.1:8080/'],
    response_types: ['code id_token', 'code'],
  },
})

function App() {
  const {
    initialized,
    oauthAgent,
    bskyAgent,
    signedIn,
    signOut,
    error,
    loading,
    signIn,
  } = useOAuth(client)
  const [profile, setProfile] = useState<{
    value: { displayName?: string }
  } | null>(null)

  const loadProfile = useCallback(async () => {
    if (!oauthAgent) return

    const info = await oauthAgent.getUserinfo()
    console.log('info', info)

    if (!bskyAgent) return

    // A call that requires to be authenticated
    console.log(
      await bskyAgent.com.atproto.server.getServiceAuth({
        aud: info.sub,
      }),
    )

    // This call does not require authentication
    const profile = await bskyAgent.com.atproto.repo.getRecord({
      repo: info.sub,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
    })

    console.log(profile)

    setProfile(profile.data)
  }, [oauthAgent, bskyAgent])

  if (!initialized) {
    return <p>{error || 'Loading...'}</p>
  }

  return signedIn ? (
    <div>
      <p>Logged in!</p>
      <button onClick={loadProfile}>Load profile</button>
      <code>
        <pre>{profile ? JSON.stringify(profile, undefined, 2) : null}</pre>
      </code>

      <button onClick={signOut}>Logout</button>
    </div>
  ) : (
    <LoginForm error={error} loading={loading} onLogin={signIn} />
  )
}

export default App
