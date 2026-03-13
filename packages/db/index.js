'use strict'

const path = require('path')

function loadPrismaClient() {
  const candidates = [
    path.join(__dirname, 'node_modules/.prisma/client'),
    path.join(__dirname, '../../apps/web/.prisma/client'),
    path.join(__dirname, '../../node_modules/.prisma/client'),
    '@prisma/client',
  ]

  let lastError

  for (const candidate of candidates) {
    try {
      const mod = candidate.startsWith('/') ? require(candidate) : require(candidate)
      if (mod?.PrismaClient && mod?.Prisma) return mod
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Failed to load Prisma client')
}

const {
  PrismaClient,
  Prisma,
  MemberRole,
  ArticleStatus,
  ArticleFeedbackType,
} = loadPrismaClient()

module.exports = {
  PrismaClient,
  Prisma,
  MemberRole,
  ArticleStatus,
  ArticleFeedbackType,
}
