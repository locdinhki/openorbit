// ============================================================================
// ext-ghl — Extension Zustand Store
// ============================================================================

import { create } from 'zustand'
import { createContactsSlice, type ContactsSlice } from './contactsSlice'
import { createOpportunitiesSlice, type OpportunitiesSlice } from './opportunitiesSlice'
import { createSettingsSlice, type SettingsSlice } from './settingsSlice'
import { createChatSlice, type ChatSlice } from './chatSlice'

export type ExtGhlStore = ContactsSlice & OpportunitiesSlice & SettingsSlice & ChatSlice

export const useExtGhlStore = create<ExtGhlStore>()((...a) => ({
  ...createContactsSlice(...a),
  ...createOpportunitiesSlice(...a),
  ...createSettingsSlice(...a),
  ...createChatSlice(...a)
}))

export const useStore = useExtGhlStore
