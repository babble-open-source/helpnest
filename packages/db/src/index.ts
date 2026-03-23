export { PrismaClient, Prisma } from '../generated/prisma/client'
export { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

/**
 * Creates a configured PrismaClient instance with the PrismaPg adapter.
 * Use this in CLI tools and scripts that need their own client instance.
 * For Next.js apps, use the singleton in apps/web/src/lib/db.ts instead.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}
export type {
  Workspace,
  User,
  Member,
  Collection,
  Article,
  ArticleVersion,
  ApiKey,
  SearchIndex,
  ArticleFeedback,
  Invite,
  Conversation,
  Message,
  ConversationArticle,
  KnowledgeGap,
} from '../generated/prisma/client'
export {
  MemberRole,
  ArticleStatus,
  ArticleFeedbackType,
  ConversationStatus,
  MessageRole,
  AiProvider,
  CollectionVisibility,
} from '../generated/prisma/client'
