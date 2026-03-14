'use client'

import React, { useState } from 'react'
import { NotionImportModal } from './NotionImportModal'
import { IntercomImportModal } from './IntercomImportModal'
import { ZendeskImportModal } from './ZendeskImportModal'
import { FreshdeskImportModal } from './FreshdeskImportModal'
import { HelpScoutImportModal } from './HelpScoutImportModal'
import { CsvImportModal } from './CsvImportModal'

type SourceId = 'notion' | 'intercom' | 'zendesk' | 'freshdesk' | 'helpscout' | 'csv' | 'mintlify'

interface Source {
  id: SourceId
  name: string
  description: string
  comingSoon?: boolean
}

interface Props {
  source: Source
}

function NotionLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-ink">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
    </svg>
  )
}

function IntercomLogo() {
  return <img src="/imports/intercom.svg" alt="Intercom" className="w-8 h-8" />
}

function ZendeskLogo() {
  return <img src="/imports/zendesk.svg" alt="Zendesk" className="w-8 h-8" />
}

function FreshdeskLogo() {
  return <img src="/imports/freshdesk.svg" alt="Freshdesk" className="w-8 h-8" />
}

function HelpScoutLogo() {
  return <img src="/imports/helpscout.svg" alt="Help Scout" className="w-8 h-8" />
}

function CsvLogo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 text-muted">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  )
}

function MintlifyLogo() {
  return <img src="/imports/mintlify.svg" alt="Mintlify" className="w-8 h-8" />
}

const LOGOS: Record<SourceId, () => React.ReactElement> = {
  notion: NotionLogo,
  intercom: IntercomLogo,
  zendesk: ZendeskLogo,
  freshdesk: FreshdeskLogo,
  helpscout: HelpScoutLogo,
  csv: CsvLogo,
  mintlify: MintlifyLogo,
}

export function ImportSourceCard({ source }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const Logo = LOGOS[source.id]

  return (
    <>
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <Logo />
          {source.comingSoon && (
            <span className="text-xs font-medium bg-cream text-muted border border-border px-2 py-0.5 rounded-full">
              Coming soon
            </span>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-ink text-sm mb-1">{source.name}</h3>
          <p className="text-xs text-muted leading-relaxed">{source.description}</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          disabled={source.comingSoon}
          className="bg-ink text-cream px-4 py-2 rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed w-full"
        >
          Import
        </button>
      </div>

      {modalOpen && source.id === 'notion' && (
        <NotionImportModal onClose={() => setModalOpen(false)} />
      )}
      {modalOpen && source.id === 'intercom' && (
        <IntercomImportModal onClose={() => setModalOpen(false)} />
      )}
      {modalOpen && source.id === 'zendesk' && (
        <ZendeskImportModal onClose={() => setModalOpen(false)} />
      )}
      {modalOpen && source.id === 'freshdesk' && (
        <FreshdeskImportModal onClose={() => setModalOpen(false)} />
      )}
      {modalOpen && source.id === 'helpscout' && (
        <HelpScoutImportModal onClose={() => setModalOpen(false)} />
      )}
      {modalOpen && source.id === 'csv' && (
        <CsvImportModal onClose={() => setModalOpen(false)} />
      )}
    </>
  )
}
