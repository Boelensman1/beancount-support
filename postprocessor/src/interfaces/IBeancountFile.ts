import type { Decimal } from 'decimal.js'
import {
  Currency,
  PostingAccount,
  PostingLine,
  TransactionsBlock,
} from './TaggedStrings.js'

export interface Posting {
  flag: string | null
  account: PostingAccount
  line: PostingLine
}

export interface Transaction {
  block: TransactionsBlock
  date: Date
  flags: Set<string>
  payee: string
  narration: string
  postings: Posting[]
  meta: {
    amount: Decimal
    currency: Currency
    account: PostingAccount
  }
}

export interface IBeancountFile {
  blocks: Set<TransactionsBlock>
  transactions: Transaction[]

  // constructor(file: string): Promise<void>
  toString(): string
  stringToPosting(arg0: string): Posting
}
