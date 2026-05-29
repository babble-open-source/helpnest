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
  // K1+K2 new models
  Contact,
  Organization,
  ContactOrganization,
  WorkspaceCounter,
  ConversationEvent,
} from './generated/prisma/client'
export {
  MemberRole,
  ArticleStatus,
  ArticleFeedbackType,
  ConversationStatus,
  MessageRole,
  AiProvider,
  CollectionVisibility,
  // K1+K2 new enums
  ContactOrgSource,
  ContactOrgRole,
  EventActorType,
  ConversationEventVerb,
} from './generated/prisma/client'
