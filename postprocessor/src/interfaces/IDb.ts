import { Transaction } from './IBeancountFile.js'
import {
  AutoPostingMatcherName,
  Currency,
  AutoPostingLine,
  PostingAccount,
} from './TaggedStrings.js'

export interface AutoPostingPosting {
  flag: string | null
  account: PostingAccount
  line: AutoPostingLine // amount, currency etc.
}

interface AutoPostingMatcherBase {
  name: AutoPostingMatcherName // unique!
  expectedAmountMin: number
  expectedAmountMax: number
  expectedCurrency: Currency
  expectedAccounts: PostingAccount[]

  postings: AutoPostingPosting[] // lines to be inserted
}

// to be implemented
export interface AutoPostingMatcherML extends AutoPostingMatcherBase {
  matchType: 'machinelearning'
  matchOptions: {
    minConfidence: number
  }
}

export interface AutoPostingMatcherRegex extends AutoPostingMatcherBase {
  matchType: 'regex'
  matchOptions: {
    matchOn: 'date' | 'payee' | 'narration' | 'amount'
    regex: RegExp
  }
}

export interface AutoPostingMatcherComposite extends AutoPostingMatcherBase {
  matchType: 'composite'
  matchOptions: {
    matchers: AutoPostingMatcher[]
    matchType: 'any' | 'all' | 'none'
  }
}

export type AutoPostingMatcher =
  | AutoPostingMatcherML
  | AutoPostingMatcherRegex
  | AutoPostingMatcherComposite

export interface IDB {
  addAutoPostingMatcher(arg0: AutoPostingMatcher, order: number): Promise<void>
  updateAutoPostingMatcher(
    arg0: AutoPostingMatcherName,
    arg1: AutoPostingMatcher,
  ): Promise<void>
  getAutoPostingMatchers(): Promise<AutoPostingMatcher[]>
  removeAutoPostingMatcher(arg0: AutoPostingMatcherName): Promise<void>
  matchTransaction(arg0: Transaction): AutoPostingMatcher | null

  addAccount(arg0: PostingAccount): Promise<void>
  getAccounts(): Promise<PostingAccount[]>
  removeAccount(arg0: PostingAccount): Promise<void>

  addPostingAccount(arg0: PostingAccount): Promise<void>
  getPostingAccounts(): Promise<PostingAccount[]>
}
