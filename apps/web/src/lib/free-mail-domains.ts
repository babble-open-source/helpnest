/**
 * Set of well-known free/consumer email provider domains.
 *
 * Used by autoAssociateContactToOrg to skip domain-based org matching for
 * contacts whose email domain cannot identify a B2B organization.
 *
 * Source: curated from the open-source list at
 * https://github.com/disposable-email-domains/disposable-email-domains
 * combined with the top consumer providers by global market share (2024).
 * Update this list when adding CRM sync (K5) — CRM-sourced org membership
 * overrides domain-matching entirely, so the free-mail list only matters for
 * the DOMAIN auto-association path.
 */
export const FREE_MAIL_DOMAINS: Set<string> = new Set([
  // Google
  'gmail.com',
  'googlemail.com',
  // Microsoft
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.es',
  'hotmail.it',
  'live.com',
  'live.co.uk',
  'live.fr',
  'live.de',
  'msn.com',
  'outlook.com',
  'outlook.co.uk',
  'outlook.fr',
  'outlook.de',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.jp',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.in',
  'ymail.com',
  // AOL / Verizon
  'aol.com',
  'aim.com',
  'verizon.net',
  // Other large consumer providers
  'protonmail.com',
  'proton.me',
  'tutanota.com',
  'tutanota.de',
  'tutamail.com',
  'tuta.io',
  'zohomail.com',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  'yandex.com',
  'yandex.ru',
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'rediffmail.com',
  'inbox.com',
  'fastmail.com',
  'fastmail.fm',
  'hushmail.com',
  'runbox.com',
  'mailfence.com',
  'posteo.de',
  'pm.me',
])
