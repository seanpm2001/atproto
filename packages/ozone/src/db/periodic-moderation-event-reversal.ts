import { wait } from '@atproto/common'
import { Leader } from './leader'
import { dbLogger } from '../logger'
import AppContext from '../context'
import { ReversalSubject } from '../services/moderation'

export const MODERATION_ACTION_REVERSAL_ID = 1011

export class PeriodicModerationEventReversal {
  leader = new Leader(MODERATION_ACTION_REVERSAL_ID, this.appContext.db)
  destroyed = false

  constructor(private appContext: AppContext) {}

  async revertState(subject: ReversalSubject) {
    await this.appContext.db.transaction(async (dbTxn) => {
      const moderationTxn = this.appContext.services.moderation(dbTxn)
      const originalEvent =
        await moderationTxn.getLastReversibleEventForSubject(subject)
      if (originalEvent) {
        await moderationTxn.revertState({
          action: originalEvent.action,
          createdBy: originalEvent.createdBy,
          comment:
            '[SCHEDULED_REVERSAL] Reverting action as originally scheduled',
          subject: subject.subject,
          createdAt: new Date(),
        })
      }
    })
  }

  async findAndRevertDueActions() {
    const moderationService = this.appContext.services.moderation(
      this.appContext.db,
    )
    const subjectsDueForReversal =
      await moderationService.getSubjectsDueForReversal()

    // We shouldn't have too many actions due for reversal at any given time, so running in parallel is probably fine
    // Internally, each reversal runs within its own transaction
    await Promise.all(subjectsDueForReversal.map(this.revertState.bind(this)))
  }

  async run() {
    while (!this.destroyed) {
      try {
        const { ran } = await this.leader.run(async ({ signal }) => {
          while (!signal.aborted) {
            // super basic synchronization by agreeing when the intervals land relative to unix timestamp
            const now = Date.now()
            const intervalMs = 1000 * 60
            const nextIteration = Math.ceil(now / intervalMs)
            const nextInMs = nextIteration * intervalMs - now
            await wait(nextInMs)
            if (signal.aborted) break
            await this.findAndRevertDueActions()
          }
        })
        if (ran && !this.destroyed) {
          throw new Error('View maintainer completed, but should be persistent')
        }
      } catch (err) {
        dbLogger.error(
          {
            err,
            lockId: MODERATION_ACTION_REVERSAL_ID,
          },
          'moderation action reversal errored',
        )
      }
      if (!this.destroyed) {
        await wait(10000 + jitter(2000))
      }
    }
  }

  destroy() {
    this.destroyed = true
    this.leader.destroy()
  }
}

function jitter(maxMs) {
  return Math.round((Math.random() - 0.5) * maxMs * 2)
}
