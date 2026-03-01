// ============================================================================
// ext-plaid — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { EXT_PLAID_IPC } from '../ipc-channels'
import { extPlaidSchemas } from '../ipc-schemas'
import { PlaidClient, type PlaidEnvironment } from './sdk/client'
import { PlaidItemsRepo } from './db/items-repo'
import { PlaidAccountsRepo } from './db/accounts-repo'
import { PlaidTransactionsRepo } from './db/transactions-repo'
import { PlaidSyncCursorsRepo } from './db/sync-cursors-repo'

let plaidClient: PlaidClient | null = null

function getSettings(): SettingsRepo {
  return new SettingsRepo()
}

function getPlaidClient(): PlaidClient {
  if (!plaidClient) {
    const settings = getSettings()
    const clientId = settings.get('plaid.client-id') as string | null
    const secret = settings.get('plaid.secret') as string | null
    const environment = (settings.get('plaid.environment') as PlaidEnvironment) ?? 'sandbox'
    if (!clientId || !secret) throw new Error('Plaid credentials not configured')
    plaidClient = new PlaidClient(clientId, secret, environment)
  }
  return plaidClient
}

function resetPlaidClient(): void {
  plaidClient = null
}

export function registerExtPlaidHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const itemsRepo = new PlaidItemsRepo(db)
  const accountsRepo = new PlaidAccountsRepo(db)
  const transactionsRepo = new PlaidTransactionsRepo(db)
  const cursorsRepo = new PlaidSyncCursorsRepo(db)

  // ===== Settings =====

  ipc.handle(EXT_PLAID_IPC.SETTINGS_GET, extPlaidSchemas['ext-plaid:settings-get'], () => {
    try {
      const settings = getSettings()
      const clientId = settings.get('plaid.client-id') as string | null
      const secret = settings.get('plaid.secret') as string | null
      const environment = settings.get('plaid.environment') as string | null
      return {
        success: true,
        data: {
          hasCredentials: !!(clientId && secret),
          environment: environment ?? 'sandbox'
        }
      }
    } catch (err) {
      log.error('Failed to get settings', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_PLAID_IPC.SETTINGS_SET,
    extPlaidSchemas['ext-plaid:settings-set'],
    (_event, { clientId, secret, environment }) => {
      try {
        const settings = getSettings()
        if (clientId !== undefined) settings.set('plaid.client-id', clientId)
        if (secret !== undefined) settings.set('plaid.secret', secret)
        if (environment !== undefined) settings.set('plaid.environment', environment)
        resetPlaidClient()
        return { success: true, data: { saved: true } }
      } catch (err) {
        log.error('Failed to save settings', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Link =====

  ipc.handle(
    EXT_PLAID_IPC.LINK_TOKEN_CREATE,
    extPlaidSchemas['ext-plaid:link-token-create'],
    async (_event, { userId }) => {
      try {
        const client = getPlaidClient()
        const result = await client.createLinkToken(userId ?? 'default-user')
        return { success: true, data: { linkToken: result.link_token } }
      } catch (err) {
        log.error('Failed to create link token', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_PLAID_IPC.LINK_EXCHANGE,
    extPlaidSchemas['ext-plaid:link-exchange'],
    async (_event, { publicToken }) => {
      try {
        const client = getPlaidClient()
        const exchangeResult = await client.exchangePublicToken(publicToken)
        const accessToken = exchangeResult.access_token
        const itemId = exchangeResult.item_id

        // Get institution info
        const itemInfo = await client.getItem(accessToken)
        let institutionName: string | undefined
        if (itemInfo.item.institution_id) {
          try {
            const institution = await client.getInstitution(itemInfo.item.institution_id)
            institutionName = institution.name
          } catch {
            // Institution lookup failed, continue without name
          }
        }

        // Save item
        itemsRepo.insert({
          id: itemId,
          accessToken,
          institutionId: itemInfo.item.institution_id ?? undefined,
          institutionName
        })

        // Fetch and save accounts
        const accountsResult = await client.getAccounts(accessToken)
        for (const account of accountsResult.accounts) {
          accountsRepo.upsert({
            id: account.account_id,
            itemId,
            name: account.name,
            officialName: account.official_name,
            type: account.type,
            subtype: account.subtype ?? undefined,
            currentBalance: account.balances.current,
            availableBalance: account.balances.available,
            currency: account.balances.iso_currency_code,
            mask: account.mask
          })
        }

        return {
          success: true,
          data: {
            itemId,
            institutionName,
            accountCount: accountsResult.accounts.length
          }
        }
      } catch (err) {
        log.error('Failed to exchange public token', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Items =====

  ipc.handle(EXT_PLAID_IPC.ITEMS_LIST, extPlaidSchemas['ext-plaid:items-list'], () => {
    try {
      const items = itemsRepo.list()
      return { success: true, data: items }
    } catch (err) {
      log.error('Failed to list items', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_PLAID_IPC.ITEMS_REMOVE,
    extPlaidSchemas['ext-plaid:items-remove'],
    async (_event, { itemId }) => {
      try {
        const item = itemsRepo.getById(itemId)
        if (!item) return { success: false, error: 'Item not found', code: 'NOT_FOUND' }

        // Remove from Plaid
        const client = getPlaidClient()
        await client.removeItem(item.access_token)

        // Remove from local DB (cascades to accounts and transactions)
        cursorsRepo.delete(itemId)
        itemsRepo.delete(itemId)

        return { success: true, data: { removed: true } }
      } catch (err) {
        log.error('Failed to remove item', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Accounts =====

  ipc.handle(
    EXT_PLAID_IPC.ACCOUNTS_LIST,
    extPlaidSchemas['ext-plaid:accounts-list'],
    (_event, { itemId }) => {
      try {
        const accounts = itemId ? accountsRepo.listByItem(itemId) : accountsRepo.list()
        return { success: true, data: accounts }
      } catch (err) {
        log.error('Failed to list accounts', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_PLAID_IPC.ACCOUNTS_SYNC,
    extPlaidSchemas['ext-plaid:accounts-sync'],
    async (_event, { itemId }) => {
      try {
        const client = getPlaidClient()
        const items = itemId ? [itemsRepo.getById(itemId)].filter(Boolean) : itemsRepo.listActive()

        let synced = 0
        for (const item of items) {
          if (!item) continue
          const result = await client.getAccounts(item.access_token)
          for (const account of result.accounts) {
            accountsRepo.upsert({
              id: account.account_id,
              itemId: item.id,
              name: account.name,
              officialName: account.official_name,
              type: account.type,
              subtype: account.subtype ?? undefined,
              currentBalance: account.balances.current,
              availableBalance: account.balances.available,
              currency: account.balances.iso_currency_code,
              mask: account.mask
            })
            synced++
          }
        }

        return { success: true, data: { synced } }
      } catch (err) {
        log.error('Failed to sync accounts', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Transactions =====

  ipc.handle(
    EXT_PLAID_IPC.TRANSACTIONS_LIST,
    extPlaidSchemas['ext-plaid:transactions-list'],
    (_event, { accountId, startDate, endDate, limit, offset }) => {
      try {
        const transactions = transactionsRepo.list({ accountId, startDate, endDate, limit, offset })
        return { success: true, data: transactions }
      } catch (err) {
        log.error('Failed to list transactions', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_PLAID_IPC.TRANSACTIONS_SYNC,
    extPlaidSchemas['ext-plaid:transactions-sync'],
    async (_event, { itemId }) => {
      try {
        const client = getPlaidClient()
        const items = itemId ? [itemsRepo.getById(itemId)].filter(Boolean) : itemsRepo.listActive()

        let added = 0
        let modified = 0
        let removed = 0

        for (const item of items) {
          if (!item) continue

          let cursor = cursorsRepo.get(item.id) ?? undefined
          let hasMore = true

          while (hasMore) {
            const result = await client.syncTransactions(item.access_token, cursor)

            // Process added transactions
            for (const txn of result.added) {
              transactionsRepo.upsert({
                id: txn.transaction_id,
                accountId: txn.account_id,
                amount: txn.amount,
                date: txn.date,
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category,
                categoryId: txn.category_id,
                pending: txn.pending,
                raw: txn
              })
              added++
            }

            // Process modified transactions
            for (const txn of result.modified) {
              transactionsRepo.upsert({
                id: txn.transaction_id,
                accountId: txn.account_id,
                amount: txn.amount,
                date: txn.date,
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category,
                categoryId: txn.category_id,
                pending: txn.pending,
                raw: txn
              })
              modified++
            }

            // Process removed transactions
            if (result.removed.length > 0) {
              const removedIds = result.removed.map((r) => r.transaction_id)
              transactionsRepo.removeDeleted(removedIds)
              removed += removedIds.length
            }

            cursor = result.next_cursor
            hasMore = result.has_more

            ipc.push(EXT_PLAID_IPC.SYNC_PROGRESS, {
              itemId: item.id,
              added,
              modified,
              removed,
              hasMore
            })
          }

          // Save cursor for next sync
          if (cursor) {
            cursorsRepo.set(item.id, cursor)
          }
        }

        return { success: true, data: { added, modified, removed } }
      } catch (err) {
        log.error('Failed to sync transactions', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-plaid IPC handlers registered (10 channels)')
}
