'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Mail, Phone, Building2, User, Link2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface OrganizationSummary {
  id: string
  name: string
  plan: string | null
}

interface ContactSummary {
  id: string
  fullName: string | null
  email: string | null
  phone: string | null
  avatarUrl: string | null
  primaryOrganization: OrganizationSummary | null
}

interface CustomerSearchResult {
  id: string
  fullName: string | null
  email: string | null
}

export interface CustomerContextPanelProps {
  conversationId: string
  contact: ContactSummary | null
  organization: OrganizationSummary | null
  onContactLinked: (contact: CustomerSearchResult) => void
}

// ── Sub-components ─────────────────────────────────────────────────────────

function AvatarInitial({ name, email }: { name: string | null; email: string | null }) {
  const initial = ((name ?? email ?? '?')[0] ?? '?').toUpperCase()
  return (
    <div
      className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground shrink-0"
      aria-hidden="true"
    >
      {initial}
    </div>
  )
}

function OrgCard({ org }: { org: OrganizationSummary }) {
  return (
    <div className="mt-3 pt-3 border-t">
      <div className="flex items-center gap-1.5 mb-1">
        <Building2 className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Organization
        </span>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-sm text-foreground font-medium truncate flex-1">{org.name}</p>
        {org.plan && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {org.plan}
          </Badge>
        )}
      </div>
    </div>
  )
}

// ── Link contact modal ─────────────────────────────────────────────────────

interface LinkContactModalProps {
  open: boolean
  onClose: () => void
  conversationId: string
  onLinked: (contact: CustomerSearchResult) => void
}

function LinkContactModal({ open, onClose, conversationId, onLinked }: LinkContactModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset state when the modal closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSearching(false)
      setLinkError(null)
    }
  }, [open])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      setResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(value.trim())}&limit=8`)
        if (res.ok) {
          const data = (await res.json()) as { customers: CustomerSearchResult[] }
          setResults(data.customers ?? [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
  }

  async function handleSelect(customer: CustomerSearchResult) {
    setLinking(true)
    setLinkError(null)
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: customer.id }),
      })
      if (res.ok) {
        onLinked(customer)
        onClose()
      } else {
        setLinkError('Failed to link contact. Please try again.')
      }
    } catch {
      setLinkError('Failed to link contact. Please try again.')
    } finally {
      setLinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Link contact</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search by name or email..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            autoFocus
            aria-label="Search contacts"
          />
          {searching && <p className="text-xs text-muted-foreground">Searching…</p>}
          {linkError && (
            <p role="alert" className="text-xs text-destructive">
              {linkError}
            </p>
          )}
          {results.length > 0 && (
            <ul className="space-y-1" role="listbox" aria-label="Contact search results">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={linking}
                    onClick={() => void handleSelect(c)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ring',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                    aria-label={`Link contact ${c.fullName ?? c.email ?? 'Unknown'}`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {c.fullName ?? c.email ?? 'Unknown'}
                    </p>
                    {c.fullName && c.email && (
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!searching && query.trim() && results.length === 0 && (
            <p className="text-xs text-muted-foreground">No contacts found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function CustomerContextPanel({
  conversationId,
  contact,
  organization,
  onContactLinked,
}: CustomerContextPanelProps) {
  const [modalOpen, setModalOpen] = useState(false)
  // Optimistic local state so UI updates immediately after linking
  const [localContact, setLocalContact] = useState<ContactSummary | null>(contact)

  // Sync if parent re-renders with a different contact (e.g. after route refresh)
  useEffect(() => {
    setLocalContact(contact)
  }, [contact])

  function handleLinked(newContact: CustomerSearchResult) {
    setLocalContact({
      id: newContact.id,
      fullName: newContact.fullName,
      email: newContact.email,
      phone: null,
      avatarUrl: null,
      primaryOrganization: organization,
    })
    onContactLinked(newContact)
  }

  const displayOrg = localContact?.primaryOrganization ?? organization

  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Customer
      </h3>

      {localContact ? (
        // ── contact-linked state ──
        <div>
          <div className="flex items-start gap-2">
            <AvatarInitial name={localContact.fullName} email={localContact.email} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {localContact.fullName ?? localContact.email ?? 'Unknown'}
              </p>
              {localContact.email && (
                <a
                  href={`mailto:${localContact.email}`}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-0.5 truncate"
                  aria-label={localContact.email}
                >
                  <Mail className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {localContact.email}
                </a>
              )}
              {localContact.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {localContact.phone}
                </p>
              )}
            </div>
          </div>
          {/* Show org from contact's primaryOrganization, or fall back to the
              conversation-level organization */}
          {displayOrg && <OrgCard org={displayOrg} />}
        </div>
      ) : (
        // ── org-linked or fully anonymous state ──
        <div>
          {organization && <OrgCard org={organization} />}
          <div className={cn('flex items-center gap-2', organization ? 'mt-3' : '')}>
            <User className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-sm text-muted-foreground flex-1">No contact linked</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="h-7 px-2 text-xs"
              aria-label="Link contact"
            >
              <Link2 className="w-3 h-3 mr-1" aria-hidden="true" />
              Link contact
            </Button>
          </div>
        </div>
      )}

      <LinkContactModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        conversationId={conversationId}
        onLinked={handleLinked}
      />
    </div>
  )
}
