#!/usr/bin/env node

/**
 * Translation completeness checker.
 * Compares all locale JSON files against en.json (source of truth).
 * Reports missing keys, extra keys, and ICU variable mismatches.
 *
 * Usage: node scripts/check-translations.js
 */

const fs = require('fs')
const path = require('path')

const MESSAGES_DIR = path.join(__dirname, '../src/messages')

function flattenKeys(obj, prefix = '') {
  const keys = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...flattenKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

function extractICUVariables(str) {
  if (typeof str !== 'string') return []
  const matches = str.match(/\{[^}]+\}/g) || []
  return matches.map((m) => m.replace(/\{|\}/g, '').split(',')[0].trim()).sort()
}

function getNestedValue(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj)
}

const enPath = path.join(MESSAGES_DIR, 'en.json')
if (!fs.existsSync(enPath)) {
  console.error('❌ en.json not found at', enPath)
  process.exit(1)
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'))
const enKeys = flattenKeys(en)

const localeFiles = fs.readdirSync(MESSAGES_DIR).filter((f) => f.endsWith('.json') && f !== 'en.json')

let hasErrors = false

for (const file of localeFiles) {
  const locale = file.replace('.json', '')
  const localePath = path.join(MESSAGES_DIR, file)
  let localeData

  try {
    localeData = JSON.parse(fs.readFileSync(localePath, 'utf8'))
  } catch (e) {
    console.error(`❌ ${file}: Invalid JSON — ${e.message}`)
    hasErrors = true
    continue
  }

  const localeKeys = flattenKeys(localeData)
  const missingKeys = enKeys.filter((k) => !localeKeys.includes(k))
  const extraKeys = localeKeys.filter((k) => !enKeys.includes(k))

  if (missingKeys.length > 0) {
    console.warn(`⚠️  ${locale}: ${missingKeys.length} missing key(s):`)
    missingKeys.forEach((k) => console.warn(`   - ${k}`))
  }

  if (extraKeys.length > 0) {
    console.warn(`⚠️  ${locale}: ${extraKeys.length} extra key(s) (not in en.json):`)
    extraKeys.forEach((k) => console.warn(`   - ${k}`))
    hasErrors = true
  }

  // Check ICU variable consistency
  const varMismatches = []
  for (const key of enKeys) {
    const enValue = getNestedValue(en, key)
    const localeValue = getNestedValue(localeData, key)
    if (typeof enValue === 'string' && typeof localeValue === 'string') {
      const enVars = extractICUVariables(enValue)
      const localeVars = extractICUVariables(localeValue)
      if (JSON.stringify(enVars) !== JSON.stringify(localeVars)) {
        varMismatches.push({ key, enVars, localeVars })
      }
    }
  }

  if (varMismatches.length > 0) {
    console.warn(`⚠️  ${locale}: ${varMismatches.length} ICU variable mismatch(es):`)
    varMismatches.forEach(({ key, enVars, localeVars }) => {
      console.warn(`   - ${key}: en={${enVars.join(',')}} ${locale}={${localeVars.join(',')}}`)
    })
    hasErrors = true
  }

  if (missingKeys.length === 0 && extraKeys.length === 0 && varMismatches.length === 0) {
    console.log(`✅ ${locale}: All ${enKeys.length} keys present, ICU variables match`)
  }
}

if (hasErrors) {
  console.log('\n⚠️  Some issues found. See above for details.')
  process.exit(1)
} else {
  console.log(`\n✅ All ${localeFiles.length} locale files are complete and consistent.`)
}
