import { useState } from 'react'
import { useExtGhlStore } from '../../store/index'
import Badge from '@renderer/components/shared/Badge'
import Button from '@renderer/components/shared/Button'

export default function ContactDetail(): React.JSX.Element {
  const contact = useExtGhlStore((s) => s.selectedContact)
  const selectContact = useExtGhlStore((s) => s.selectContact)
  const [arvResult, setArvResult] = useState<{
    zestimate: number | null
    zillow_url: string | null
  } | null>(null)
  const [arvLoading, setArvLoading] = useState(false)

  if (!contact) return <div />

  const tags: string[] = (() => {
    try {
      return JSON.parse(contact.tags)
    } catch {
      return []
    }
  })()

  const customFields: { id: string; value: unknown }[] = (() => {
    try {
      return JSON.parse(contact.custom_fields)
    } catch {
      return []
    }
  })()

  const hasAddress = contact.address1 && contact.city && contact.state && contact.postal_code

  const handleGetArv = async (): Promise<void> => {
    if (!hasAddress) return
    setArvLoading(true)
    try {
      const result = (await window.api.invoke('ext-zillow:get-arv', {
        address1: contact.address1,
        city: contact.city,
        state: contact.state,
        postalCode: contact.postal_code
      })) as { success: boolean; data?: { zestimate: number | null; zillow_url: string | null } }
      if (result.success && result.data) {
        setArvResult(result.data)
      }
    } finally {
      setArvLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      {/* Back */}
      <button
        onClick={() => selectContact(null)}
        className="text-xs text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer mb-4"
      >
        &larr; Back to contacts
      </button>

      {/* Name */}
      <h2 className="text-lg font-semibold text-[var(--cos-text-primary)] mb-1">
        {contact.name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
          'Unnamed'}
      </h2>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {tags.map((tag) => (
            <Badge key={tag} variant="info">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Fields */}
      <div className="space-y-3 mb-6">
        <Field label="Email" value={contact.email} />
        <Field label="Phone" value={contact.phone} />
        <Field label="Company" value={contact.company_name} />
        <Field
          label="Address"
          value={
            hasAddress
              ? `${contact.address1}, ${contact.city}, ${contact.state} ${contact.postal_code}`
              : null
          }
        />
      </div>

      {/* ARV Section */}
      {hasAddress && (
        <div className="bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-[var(--cos-text-primary)]">Property ARV</span>
            <Button size="sm" variant="primary" onClick={handleGetArv} disabled={arvLoading}>
              {arvLoading ? 'Looking up...' : 'Get ARV'}
            </Button>
          </div>
          {arvResult && (
            <div>
              {arvResult.zestimate ? (
                <div className="text-xl font-bold text-green-400">
                  ${arvResult.zestimate.toLocaleString()}
                </div>
              ) : (
                <div className="text-sm text-[var(--cos-text-muted)]">No Zestimate found</div>
              )}
              {arvResult.zillow_url && (
                <a
                  href={arvResult.zillow_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-indigo-400 hover:text-indigo-300"
                >
                  View on Zillow
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase tracking-wider mb-2">
            Custom Fields
          </h3>
          <div className="space-y-2">
            {customFields.map((cf) => (
              <div key={cf.id} className="flex justify-between text-xs">
                <span className="text-[var(--cos-text-muted)]">{cf.id}</span>
                <span className="text-[var(--cos-text-primary)]">{String(cf.value ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value
}: {
  label: string
  value: string | null | undefined
}): React.JSX.Element | null {
  if (!value) return null
  return (
    <div>
      <div className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm text-[var(--cos-text-primary)]">{value}</div>
    </div>
  )
}
