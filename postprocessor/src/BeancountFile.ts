import fs from 'node:fs/promises'
import type {
  IBeancountFile,
  Posting,
  Transaction,
} from './interfaces/IBeancountFile.js'
import {
  Currency,
  PostingAccount,
  TransactionsBlock,
} from './interfaces/TaggedStrings.js'
import { Decimal } from 'decimal.js'

class BeancountFile implements IBeancountFile {
  blocks: Set<TransactionsBlock> = new Set()
  transactions: Transaction[] = []

  static async createFromFile(fileLocation: string) {
    const file = (await fs.readFile(fileLocation)).toString()
    return new BeancountFile(file)
  }

  constructor(file: string) {
    const fileSplit = file
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !l.startsWith(';')) // remove lines that are comments
      .filter((l) => l.length !== 0) // remove empty lines

    let currentBlock = null
    let transactionBuilding: Omit<Transaction, 'meta'> | false = false
    for (let line of fileSplit) {
      if (line.startsWith('****')) {
        // start of block
        currentBlock = line as TransactionsBlock
        this.blocks.add(currentBlock)
        continue
      }

      if (!currentBlock) {
        throw new Error('Expected to start with a transactionblock (****)')
      }

      // no transaction being build
      if (!transactionBuilding) {
        transactionBuilding = this.parseTransactionStartLine(line, currentBlock)
        continue
      }

      // transaction being build, add the posting
      const posting = this.stringToPosting(line)
      transactionBuilding.postings.push(posting)

      // add meta info
      const metaInfo = posting.line.match(/(-?\d*\.?\d*) (\w*)/)
      if (!metaInfo) {
        throw new Error(`Could not amount & currency from "${posting.line}"`)
      }
      const [, amount, currency] = metaInfo

      // we've finished building the transaction
      this.transactions.push({
        ...transactionBuilding,
        meta: {
          account: posting.account,
          amount: new Decimal(amount),
          currency: currency as Currency,
        },
      })
      transactionBuilding = false
    }
  }

  private parseTransactionStartLine(
    line: string,
    currentBlock: TransactionsBlock,
  ) {
    const regexResult = line.match(
      /^(\d{4})-(\d\d)-(\d\d) ([^ ]*) "([^"]*)"(?: "([^"]*)")?$/,
    )
    if (!regexResult) {
      throw new Error(`Coult not parse line as transaction start "${line}"`)
    }
    const [, year, month, day, flags, payee, narration] = regexResult
    return {
      block: currentBlock,
      date: new Date(
        parseInt(year),
        parseInt(month) - 1,
        parseInt(day) - 2,
        12,
      ),
      flags: new Set(flags.split('')),
      payee,
      narration,
      postings: [],
    } as Omit<Transaction, 'meta'>
  }

  stringToPosting(line: string) {
    const regexResult = line.match(/^(\w*:[\w:]*) *(.*)$/)
    if (!regexResult) {
      throw new Error(`Coult not parse line as posting "${line}"`)
    }

    const [, account, rest] = regexResult

    return {
      flag: null,
      account: account as PostingAccount,
      line: rest.trim(),
    } as Posting
  }

  toString() {
    let outputLines: string[] = []
    for (let block of this.blocks) {
      outputLines.push(block)
      this.transactions
        .filter((t) => t.block === block)
        .forEach((transaction) => {
          console.log(transaction.date.toISOString())
          const date = transaction.date.toISOString().split('T')[0]
          const flags = [...transaction.flags.values()].join('')
          const payee = `"${transaction.payee}"`
          const narration = transaction.narration
            ? `"${transaction.narration}"`
            : ''
          outputLines.push(`${date} ${flags} ${payee} ${narration}`.trim())

          transaction.postings.forEach((posting) => {
            outputLines.push(`  ${posting.account}     ${posting.line}`)
          })

          outputLines.push('') // empty line
        })

      outputLines.push('') // empty line
    }

    return outputLines.join('\n')
  }
}

export default BeancountFile
