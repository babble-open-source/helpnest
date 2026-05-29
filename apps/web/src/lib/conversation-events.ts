// apps/web/src/lib/conversation-events.ts
import { Prisma, ConversationEventVerb, EventActorType } from '@helpnest/db'
import { prisma } from '@/lib/db'

/**
 * Options for emitting a single audit event on a conversation.
 *
 * Transactional safety:
 *   - Pass `tx` for SLA-critical verbs (CONVERSATION_CREATED, STATUS_CHANGED,
 *     RESOLVED, FIRST_RESPONSE_SENT) so the event is rolled back with the
 *     mutation it records if the transaction fails.
 *   - Omit `tx` for best-effort verbs (NOTE_ADDED, AI_ANSWERED, etc.) — the
 *     function falls back to the module-level prisma singleton.
 *
 * Append-only contract:
 *   - This module only ever calls `prisma.conversationEvent.create`.
 *   - No update or delete operation is exposed.
 *   - The database enforces this at the grant level via:
 *     REVOKE UPDATE, DELETE ON "ConversationEvent" FROM PUBLIC
 *     (Migration A). Application-role connections cannot mutate rows
 *     even if a code path erroneously attempts to do so.
 *
 * actorLabel:
 *   - Denormalized display name captured at write time. Survives agent deletion
 *     and member rename so the timeline remains historically accurate.
 *   - Always supply this for AGENT and SYSTEM actors; it is optional for
 *     CUSTOMER and AI where the contact or AI label is contextually obvious.
 */
export interface EmitConversationEventOptions {
  /** Prisma transaction client. When absent, the module-level singleton is used. */
  tx?: Prisma.TransactionClient
  workspaceId: string
  conversationId: string
  actorType: EventActorType
  /** Required when actorType is AGENT; the Member.id of the acting agent. */
  actorMemberId?: string
  /** Denormalized display name — survives member deletion. */
  actorLabel?: string
  verb: ConversationEventVerb
  /** Arbitrary JSON payload, shape defined per-verb in the spec. */
  payload?: Record<string, unknown>
  /**
   * Wall-clock seconds since conversation creation.
   * Set for FIRST_RESPONSE_SENT and RESOLVED so reporting never recomputes live.
   */
  durationSeconds?: number
}

export async function emitConversationEvent(opts: EmitConversationEventOptions): Promise<void> {
  const client = opts.tx ?? prisma

  await client.conversationEvent.create({
    data: {
      workspaceId: opts.workspaceId,
      conversationId: opts.conversationId,
      actorType: opts.actorType,
      actorMemberId: opts.actorMemberId ?? null,
      actorLabel: opts.actorLabel ?? null,
      verb: opts.verb,
      ...(opts.payload !== undefined ? { payload: opts.payload as Prisma.InputJsonValue } : {}),
      durationSeconds: opts.durationSeconds ?? null,
    },
  })
}
