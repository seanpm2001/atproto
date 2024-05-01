import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import { pipethroughProcedure } from '../../../../pipethrough'

export default function (server: Server, ctx: AppContext) {
  server.tools.ozone.moderator.updateUser({
    auth: ctx.authVerifier.access,
    handler: async ({ req, input, auth }) => {
      const requester = auth.credentials.did
      return pipethroughProcedure(ctx, req, input.body, requester)
    },
  })
}
