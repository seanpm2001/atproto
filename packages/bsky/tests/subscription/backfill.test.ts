import AtpAgent from '@atproto/api'
import { SeedClient } from '../seeds/client'
import { runTestEnv, TestEnvInfo } from '@atproto/dev-env'
import { forSnapshot, processAll } from '../_util'
import usersBulk from '../seeds/users-bulk'
import { chunkArray, wait } from '@atproto/common'
import { ids } from '@atproto/api/src/client/lexicons'

describe('sync', () => {
  let testEnv: TestEnvInfo
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    testEnv = await runTestEnv({
      dbPostgresSchema: 'subscription_backfill',
      bsky: { repoSubBackfillConcurrency: 30 },
      pds: { repoBackfillLimitMs: 1 },
    })
    agent = new AtpAgent({ service: testEnv.bsky.url })
    pdsAgent = new AtpAgent({ service: testEnv.pds.url })
    sc = new SeedClient(pdsAgent)
    await wait(50) // allow pending sub to be established
    await testEnv.bsky.sub.destroy()
    await usersBulk(sc, 100)
  })

  afterAll(async () => {
    await testEnv.close()
  })

  it('ingests all repos via backfill.', async () => {
    // To confirm we haven't ingested anything outside of
    // backfill, and go well beyond the pds backfill limit.
    await wait(200)

    const dids = Object.keys(sc.dids)
      .sort() // For consistent ordering
      .map((handle) => sc.dids[handle])

    // Ensure no profiles have been indexed
    const profilesBefore = await getAllProfiles(agent, dids)
    expect(profilesBefore).toEqual([])

    // Process backfill
    testEnv.bsky.sub.resume()
    await processAll(testEnv, 30000)

    // Check all backfilled profiles
    const profilesAfter = await getAllProfiles(agent, dids)
    dids.forEach((did, i) => {
      expect([did, i]).toEqual([profilesAfter[i]?.did, i])
    })
    expect(forSnapshot(profilesAfter)).toMatchSnapshot()
  })

  it('continues processing after backfill.', async () => {
    const did = Object.values(sc.dids)[0]
    await updateProfile(pdsAgent, did, { displayName: 'updated' })
    await processAll(testEnv)
    const { data: profile } = await agent.api.app.bsky.actor.getProfile({
      actor: did,
    })
    expect(profile.displayName).toEqual('updated')
  })

  async function getAllProfiles(agent: AtpAgent, dids: string[]) {
    const profileChunks = await Promise.all(
      chunkArray(dids, 25).map(async (chunk) => {
        const { data } = await agent.api.app.bsky.actor.getProfiles({
          actors: chunk,
        })
        return data.profiles
      }),
    )
    return profileChunks.flat()
  }

  async function updateProfile(
    agent: AtpAgent,
    did: string,
    record: Record<string, unknown>,
  ) {
    return await agent.api.com.atproto.repo.putRecord(
      {
        repo: did,
        collection: ids.AppBskyActorProfile,
        rkey: 'self',
        record,
      },
      { headers: sc.getHeaders(did), encoding: 'application/json' },
    )
  }
})