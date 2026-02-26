import type { StateCreator } from 'zustand'
import type { GhlContactRow } from '../../main/db/contacts-repo'
import { ipc } from '../lib/ipc-client'

export interface ContactsSlice {
  contacts: GhlContactRow[]
  contactsLoading: boolean
  contactsSearch: string
  selectedContact: GhlContactRow | null
  setContactsSearch: (query: string) => void
  loadContacts: () => Promise<void>
  syncContacts: () => Promise<void>
  selectContact: (contact: GhlContactRow | null) => void
  syncing: boolean
}

export const createContactsSlice: StateCreator<ContactsSlice> = (set, get) => ({
  contacts: [],
  contactsLoading: false,
  contactsSearch: '',
  selectedContact: null,
  syncing: false,

  setContactsSearch: (query) => {
    set({ contactsSearch: query })
    get().loadContacts()
  },

  loadContacts: async () => {
    set({ contactsLoading: true })
    const res = await ipc.contacts.list({ query: get().contactsSearch || undefined, limit: 200 })
    if (res.success && res.data) {
      set({ contacts: res.data, contactsLoading: false })
    } else {
      set({ contactsLoading: false })
    }
  },

  syncContacts: async () => {
    set({ syncing: true })
    const res = await ipc.contacts.sync()
    set({ syncing: false })
    if (res.success) {
      await get().loadContacts()
    }
  },

  selectContact: (contact) => set({ selectedContact: contact })
})
