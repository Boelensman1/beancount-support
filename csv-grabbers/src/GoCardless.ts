import Koa from 'koa'
import Router from 'koa-router'

import got, { HTTPError, Method } from 'got'
import type { Server } from 'http'

interface AuthResponse {
  access: string
  access_expires: number
  refresh: string
  refresh_expires: number
}

interface GoCardlessBank {
  id: string
  name: string
  country_code: string
}

interface LinkCreationResponse {
  link: string
}

interface AccountListResponse {
  id: string
  status: string
  agreements: string
  accounts: string[]
  reference: string
}

interface TransactionsResponse {
  transactions: {
    booked: {
      transactionId: string
      creditorName?: string
      creditorAccount?: {
        iban: string
      }
      debtorName?: string
      debtorAccount?: {
        iban: string
      }
      transactionAmount: {
        currency: string
        amount: string
      }
      bookingDate: string
      valueDate: string
      remittanceInformationUnstructured?: string
      remittanceInformationUnstructuredArray?: string[]
      bankTransactionCode?: string
      proprietaryBankTransactionCode?: string
      currencyExchange?: {
        instructedAmount: {
          amount: string
          currency: string
        }
        sourceCurrency: string
        exchangeRate: string
        unitCurrency: string
        targetCurrency: string
      }
    }[]
    pending: {
      transactionAmount: {
        currency: string
        amount: string
      }
      valueDate: string
      remittanceInformationUnstructured: string
    }[]
  }
}

interface BalancesResponse {
  balances: {
    balanceAmount: {
      amount: string
      currency: string
    }
    balanceType: string
    referenceDate: string
  }[]
}

class GoCardless {
  secretId: string
  secretKey: string

  accessToken?: string
  refreshToken?: string
  accessTokenExpiration?: Date
  refreshTokenExpiration?: Date

  constructor(secretId: string, secretKey: string) {
    this.secretId = secretId
    this.secretKey = secretKey
  }

  private async sendRequest<T>(
    method: Method,
    url: string,
    options: any,
    ignoreAuth: boolean = false,
  ): Promise<T> {
    if (!ignoreAuth) {
      await this.authIfNeeded()
    }

    try {
      const response = await got(url, {
        method: method,
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken
            ? { Authorization: `Bearer ${this.accessToken}` }
            : {}),
          ...options.headers,
        },
        json: options.json,
        searchParams: options.searchParams,
        responseType: 'json',
      }).json<T>()
      return response
    } catch (error) {
      if (error instanceof HTTPError) {
        console.error('Error', error.response?.body)
        throw new Error('Request failed')
      }
      throw error
    }
  }

  public async auth() {
    const response = await this.sendRequest<AuthResponse>(
      'POST',
      'https://bankaccountdata.gocardless.com/api/v2/token/new/',
      {
        json: {
          secret_id: this.secretId,
          secret_key: this.secretKey,
        },
      },
      true,
    )

    this.accessToken = response.access
    this.refreshToken = response.refresh
    this.accessTokenExpiration = new Date(
      Date.now() + response.access_expires * 1000,
    )
    this.refreshTokenExpiration = new Date(
      Date.now() + response.refresh_expires * 1000,
    )
  }

  private async authIfNeeded() {
    if (!this.accessToken || new Date() >= this.accessTokenExpiration!) {
      await this.auth()
    }
  }

  public async getListOfBanks(countryCode: string): Promise<GoCardlessBank[]> {
    return this.sendRequest<GoCardlessBank[]>(
      'GET',
      `https://bankaccountdata.gocardless.com/api/v2/institutions/?country=${countryCode}`,
      {},
    )
  }

  public async getRequisitionRef(
    institutionId: string,
    bankName: string,
  ): Promise<string> {
    await this.authIfNeeded()

    let port = 6767
    const app = new Koa()
    const router = new Router()

    app.use(router.routes()).use(router.allowedMethods())

    let server: Server | null = null
    let i = 0
    const maxTries = 20
    while (i < maxTries) {
      try {
        await new Promise<void>((resolve, reject) => {
          server = app.listen(port)
          server.on('listening', resolve)
          server.on('error', (err) => {
            if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
              console.log(
                `[${bankName}] Port ${port} already in use, retrying with next (${i + 1}/${maxTries})`,
              )
              port += 1
              i += 1
              server?.close()
              reject(err)
            } else {
              reject(err)
            }
          })
        })
        break
      } catch (err) {
        if (i >= maxTries) {
          throw new Error('Could not start server after maximum retries.')
        }
      }
    }

    if (!server) {
      throw new Error('Could not start server.')
    }

    console.log(`[${bankName}] Server listening on port ${port}`)

    const response = await this.sendRequest<LinkCreationResponse>(
      'POST',
      'https://bankaccountdata.gocardless.com/api/v2/requisitions/',
      {
        json: {
          redirect: `http://localhost:${port}/`,
          institution_id: institutionId,
        },
      },
    )

    console.log(`[${bankName}] Please open:`, response.link)

    return new Promise((resolve) => {
      // Route to handle the redirect
      router.get('/', async (ctx) => {
        const ref = ctx.query.ref
        if (ref) {
          server?.close()
          resolve(ref as string)
          ctx.body = 'Got ref, this window can be closed'
        } else {
          console.log('No ref provided')
          ctx.status = 400 // Bad request
          ctx.body = 'No ref provided'
        }
      })
    })
  }

  public async listAccounts(reqRef: string): Promise<string[]> {
    const response = await this.sendRequest<AccountListResponse>(
      'GET',
      `https://bankaccountdata.gocardless.com/api/v2/requisitions/${reqRef}/`,
      {},
    )

    return response.accounts
  }

  public async listTransations(
    accountId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<TransactionsResponse['transactions']> {
    await this.authIfNeeded()

    const dateFromFormatted = dateFrom.toISOString().split('T')[0]
    const dateToFormatted = dateTo.toISOString().split('T')[0]

    const response = await this.sendRequest<TransactionsResponse>(
      'GET',
      `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/transactions/`,
      {
        searchParams: {
          date_from: dateFromFormatted,
          date_to: dateToFormatted,
        },
      },
    )

    return response.transactions
  }

  public async getBalances(
    accountId: string,
  ): Promise<BalancesResponse['balances']> {
    const response = await this.sendRequest<BalancesResponse>(
      'GET',
      `https://bankaccountdata.gocardless.com/api/v2/accounts/${accountId}/balances/`,
      {},
    )

    return response.balances
  }
}

export default GoCardless
