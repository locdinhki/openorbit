// ============================================================================
// ext-plaid — Plaid SDK Wrapper
// ============================================================================

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type LinkTokenCreateResponse,
  type ItemPublicTokenExchangeResponse,
  type AccountsGetResponse,
  type TransactionsSyncResponse,
  type ItemRemoveResponse,
  type ItemGetResponse,
  type Institution
} from 'plaid'

export type PlaidEnvironment = 'sandbox' | 'development' | 'production'

export class PlaidClient {
  private client: PlaidApi

  constructor(clientId: string, secret: string, environment: PlaidEnvironment = 'sandbox') {
    const configuration = new Configuration({
      basePath: PlaidEnvironments[environment],
      baseOptions: {
        headers: {
          'PLAID-CLIENT-ID': clientId,
          'PLAID-SECRET': secret
        }
      }
    })
    this.client = new PlaidApi(configuration)
  }

  // ===== Link =====

  async createLinkToken(userId: string): Promise<LinkTokenCreateResponse> {
    const response = await this.client.linkTokenCreate({
      user: { client_user_id: userId },
      client_name: 'OpenOrbit',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en'
    })
    return response.data
  }

  async exchangePublicToken(publicToken: string): Promise<ItemPublicTokenExchangeResponse> {
    const response = await this.client.itemPublicTokenExchange({
      public_token: publicToken
    })
    return response.data
  }

  // ===== Accounts =====

  async getAccounts(accessToken: string): Promise<AccountsGetResponse> {
    const response = await this.client.accountsGet({
      access_token: accessToken
    })
    return response.data
  }

  // ===== Transactions =====

  async syncTransactions(accessToken: string, cursor?: string): Promise<TransactionsSyncResponse> {
    const response = await this.client.transactionsSync({
      access_token: accessToken,
      cursor: cursor
    })
    return response.data
  }

  // ===== Item Management =====

  async removeItem(accessToken: string): Promise<ItemRemoveResponse> {
    const response = await this.client.itemRemove({
      access_token: accessToken
    })
    return response.data
  }

  async getItem(accessToken: string): Promise<ItemGetResponse> {
    const response = await this.client.itemGet({
      access_token: accessToken
    })
    return response.data
  }

  async getInstitution(institutionId: string): Promise<Institution> {
    const response = await this.client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us]
    })
    return response.data.institution
  }
}
