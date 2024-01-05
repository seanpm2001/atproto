import assert from 'assert'
import AppContext from '../../../../context'
import { Server } from '../../../../lexicon'
import AtpAgent from '@atproto/api'
import { mapDefined } from '@atproto/common'
import { QueryParams } from '../../../../lexicon/types/app/bsky/actor/searchActorsTypeahead'
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

export default function (server: Server, ctx: AppContext) {
  const searchActorsTypeahead = createPipeline(
    skeleton,
    hydration,
    noBlocks,
    presentation,
  )
  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.authOptionalVerifier,
    handler: async ({ params, auth }) => {
      const viewer = auth.credentials.did
      const results = await searchActorsTypeahead({ ...params, viewer }, ctx)
      return {
        encoding: 'application/json',
        body: results,
      }
    },
  })
}

const skeleton = async (inputs: SkeletonFnInput<Context, Params>) => {
  const { ctx, params } = inputs

  // @TODO
  // add typeahead option
  // add hits total
  assert(ctx.searchAgent, 'unsupported without search agent')
  const { data: res } =
    await ctx.searchAgent.api.app.bsky.unspecced.searchActorsSkeleton({
      typeahead: true,
      q: params.q ?? params.term ?? '',
      limit: params.limit,
    })

  return {
    dids: res.actors.map(({ did }) => did),
    cursor: parseString(res.cursor),
  }
}

const hydration = async (
  inputs: HydrationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, params, skeleton } = inputs
  return ctx.hydrator.hydrateProfilesBasic(skeleton.dids, params.viewer)
}

const noBlocks = (inputs: RulesFnInput<Context, Params, Skeleton>) => {
  const { ctx, skeleton, hydration } = inputs
  skeleton.dids = skeleton.dids.filter(
    (did) => !ctx.views.viewerBlockExists(did, hydration),
  )
  return skeleton
}

const presentation = (
  inputs: PresentationFnInput<Context, Params, Skeleton>,
) => {
  const { ctx, skeleton, hydration } = inputs
  const actors = mapDefined(skeleton.dids, (did) =>
    ctx.views.profileBasic(did, hydration),
  )
  return {
    actors,
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
  dids: string[]
}
