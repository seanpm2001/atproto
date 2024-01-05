import assert from 'assert'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import AtpAgent from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { QueryParams } from '../../../../lexicon/types/app/bsky/feed/searchPosts'
import {
  HydrationFnInput,
  PresentationFnInput,
  RulesFnInput,
  SkeletonFnInput,
  createPipeline,
} from '../../../../pipeline'
import { Hydrator } from '../../../../hydration/hydrator'
import { Views } from '../../../../views'
import { DataPlaneClient } from '../../../../data-plane'
import { parseString } from '../../../../hydration/util'
import { creatorFromUri } from '../../../../views/util'

export default function (server: Server, ctx: AppContext) {
  const searchPosts = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.feed.searchPosts({
    auth: ctx.authOptionalVerifier,
    handler: async ({ auth, params }) => {
      const viewer = auth.credentials.did
      const results = await searchPosts({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: results,
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs

  assert(ctx.searchAgent, 'unsupported without search agent')
  const { data: res } =
    await ctx.searchAgent.api.app.bsky.unspecced.searchPostsSkeleton({
      q: params.q,
      cursor: params.cursor,
      limit: params.limit,
    })

  return {
    posts: res.posts.map(({ uri }) => uri),
    cursor: parseString(res.cursor),
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydratePosts(skeleton.posts, params.viewer)
}

const noBlocks = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.posts = skeleton.posts.filter((uri) => {
    const creator = creatorFromUri(uri)
    return !ctx.views.viewerBlockExists(creator, hydration)
  })
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const posts = mapDefined(skeleton.posts, (uri) =>
    ctx.views.post(uri, hydration),
  )
  return {
    posts,
    cursor: skeleton.cursor,
    hitsTotal: skeleton.hitsTotal,
  }
}

type Context = {
  dataplane: DataPlaneClient
  hydrator: Hydrator
  views: Views
  searchAgent?: AtpAgent
}

type Params = QueryParams & { viewer: string | null }

type Skeleton = {
  posts: string[]
  hitsTotal?: number
  cursor?: string
}
