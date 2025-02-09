import { JSONFilePreset } from 'lowdb/node'
import type { Low } from 'lowdb'

import type {
  AutoPostingMatcher,
  AutoPostingMatcherRegex,
  IDB,
} from './interfaces/IDb.js'
import {
  AutoPostingMatcherName,
  PostingAccount,
} from './interfaces/TaggedStrings.js'
import { Transaction } from './interfaces/IBeancountFile.js'

interface LowDbStructure {
  autoPostingMatchers: AutoPostingMatcher[]
  accounts: PostingAccount[]
  postingAccounts: PostingAccount[]
}

const initialDb: LowDbStructure = {
  autoPostingMatchers: [],
  accounts: [],
  postingAccounts: [],
}

const isRegexMatch = (
  autoPostingMatcher: AutoPostingMatcherRegex,
  transaction: Transaction,
) => {
  const toMatch = { ...transaction, ...transaction.meta }[
    autoPostingMatcher.matchOptions.matchOn
  ]
  const regex = new RegExp(autoPostingMatcher.matchOptions.regex)
  return Boolean(regex.exec(toMatch.toString()))
}

const isMatch = (
  autoPostingMatcher: AutoPostingMatcher,
  transaction: Transaction,
) => {
  switch (autoPostingMatcher.matchType) {
    case 'regex':
      return isRegexMatch(autoPostingMatcher, transaction)
    default:
      throw new Error(`Not implemented (${autoPostingMatcher.matchType})`)
  }
}

const validateMatch = (
  autoPostingMatcher: AutoPostingMatcher,
  transaction: Transaction,
) => {
  if (
    autoPostingMatcher.expectedAmountMax > transaction.meta.amount.toNumber()
  ) {
    throw new Error(
      `Transaction ${transaction.payee} ${transaction.narration} has amount (${transaction.meta.amount}) > expectedAmountMax (${autoPostingMatcher.expectedAmountMax})`,
    )
  }

  if (
    autoPostingMatcher.expectedAmountMin < transaction.meta.amount.toNumber()
  ) {
    throw new Error(
      `Transaction ${transaction.payee} ${transaction.narration} has amount (${transaction.meta.amount}) < expectedAmountMin (${autoPostingMatcher.expectedAmountMin})`,
    )
  }

  if (!autoPostingMatcher.expectedAccounts.includes(transaction.meta.account)) {
    throw new Error(
      `Transaction ${transaction.payee} ${transaction.narration} is from unexpected account (${transaction.meta.account})`,
    )
  }

  if (autoPostingMatcher.expectedCurrency !== transaction.meta.currency) {
    throw new Error(
      `Transaction ${transaction.payee} ${transaction.narration} has unexpected currency (${transaction.meta.currency}, expected ${autoPostingMatcher.expectedCurrency})`,
    )
  }

  return true
}

class DB implements IDB {
  lowdb: Low<LowDbStructure>

  static async createDb() {
    const lowdb = await JSONFilePreset<LowDbStructure>('db.json', initialDb)
    return new DB(lowdb)
  }

  constructor(lowdb: Low<LowDbStructure>) {
    this.lowdb = lowdb
  }

  async addAutoPostingMatcher(
    autoPostingMatcher: AutoPostingMatcher,
    order: number,
  ) {
    await this.lowdb.read()

    if (order < 0) {
      throw new Error('Order must be > 0')
    }

    if (order > this.lowdb.data.autoPostingMatchers.length) {
      throw new Error('Order must be < len(autoPostingMatchers)')
    }

    await this.lowdb.update(({ autoPostingMatchers }) => {
      autoPostingMatchers.splice(order, 0, autoPostingMatcher)
    })
  }

  async updateAutoPostingMatcher(
    autoPostingMatcherName: AutoPostingMatcherName,
    autoPostingMatcher: AutoPostingMatcher,
  ) {
    await this.lowdb.read()
    return this.lowdb.update(({ autoPostingMatchers }) => {
      const oldEntryIndex = autoPostingMatchers.findIndex(
        ({ name }) => name === autoPostingMatcherName,
      )

      autoPostingMatchers.splice(oldEntryIndex, 1, autoPostingMatcher)
    })
  }

  async getAutoPostingMatchers() {
    await this.lowdb.read()
    return this.lowdb.data.autoPostingMatchers
  }

  matchTransaction(transaction: Transaction) {
    const { autoPostingMatchers } = this.lowdb.data
    for (let autoPostingMatcher of autoPostingMatchers) {
      if (isMatch(autoPostingMatcher, transaction)) {
        validateMatch(autoPostingMatcher, transaction)

        return autoPostingMatcher
      }
    }

    return null
  }

  async addAccount(account: PostingAccount) {
    await this.lowdb.read()

    if (this.lowdb.data.accounts.includes(account)) {
      throw new Error(`Account with name ${account} already exists`)
    }

    await this.lowdb.update(({ accounts }) => {
      accounts.push(account)
    })

    await this.lowdb.write()
  }

  async getAccounts() {
    await this.lowdb.read()
    return this.lowdb.data.accounts
  }

  async removeAccount(account: PostingAccount) {
    await this.lowdb.read()

    await this.lowdb.update(({ accounts }) => {
      const index = accounts.indexOf(account)
      if (index === -1) {
        throw new Error(`Account with name "${account} not founc"`)
      }
      accounts.splice(index, 1)
    })

    await this.lowdb.write()
  }

  async addPostingAccount(postingAccount: PostingAccount) {
    await this.lowdb.read()

    const end = this.lowdb.data.postingAccounts.length
    await this.lowdb.update(({ postingAccounts }) => {
      postingAccounts.splice(end, 0, postingAccount)
    })

    await this.lowdb.write()
  }

  async getPostingAccounts() {
    await this.lowdb.read()
    return this.lowdb.data.postingAccounts
  }

  async removeAutoPostingMatcher(name: string) {
    await this.lowdb.read()

    const index = this.lowdb.data.autoPostingMatchers.findIndex(
      (matcher) => matcher.name === name,
    )
    if (index === -1) {
      throw new Error(`AutoPostingMatcher with name "${name}" not found`)
    }

    this.lowdb.data.autoPostingMatchers.splice(index, 1)
    await this.lowdb.write()
  }
}

export default DB
