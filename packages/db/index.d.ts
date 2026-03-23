export { PrismaClient, Prisma } from './generated/prisma/client'
export { PrismaPg } from '@prisma/adapter-pg'
export declare function createPrismaClient(connectionString: string): PrismaClient
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
} from './generated/prisma/client'
export { MemberRole, ArticleStatus, ArticleFeedbackType, ConversationStatus, MessageRole, AiProvider, CollectionVisibility } from './generated/prisma/client'
