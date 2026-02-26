import { useEffect } from 'react'
import { useExtGhlStore } from '../../store/index'

export default function ContactList(): React.JSX.Element {
  const contacts = useExtGhlStore((s) => s.contacts)
  const contactsLoading = useExtGhlStore((s) => s.contactsLoading)
  const contactsSearch = useExtGhlStore((s) => s.contactsSearch)
  const setContactsSearch = useExtGhlStore((s) => s.setContactsSearch)
  const loadContacts = useExtGhlStore((s) => s.loadContacts)
  const selectContact = useExtGhlStore((s) => s.selectContact)

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search contacts..."
          value={contactsSearch}
          onChange={(e) => setContactsSearch(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* List */}
      {contactsLoading ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
          Loading...
        </div>
      ) : contacts.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
          {contactsSearch ? 'No matches' : 'No contacts synced'}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {contacts.map((c) => (
            <button
              key={c.id}
              onClick={() => selectContact(c)}
              className="w-full px-3 py-2 text-left hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors border-b border-[var(--cos-border)]"
            >
              <div className="text-xs font-medium text-[var(--cos-text-primary)] truncate">
                {c.name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed'}
              </div>
              <div className="text-[10px] text-[var(--cos-text-muted)] truncate">
                {[c.email, c.phone].filter(Boolean).join(' · ') || 'No contact info'}
              </div>
              {c.company_name && (
                <div className="text-[10px] text-[var(--cos-text-muted)] truncate">
                  {c.company_name}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
