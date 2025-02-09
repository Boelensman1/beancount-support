import fs from 'node:fs/promises'
import path from 'node:path'
import { stringify } from 'csv-stringify/sync'
import { input, checkbox, select } from '@inquirer/prompts'

import GoCardless from './GoCardless.js'
import { goCardlessSecretId, goCardlessSecretKey } from './secrets.js'
import type Db from './Db.js'

const location = path.resolve('.', '..', '..', 'for-import')

const goCardless = new GoCardless(goCardlessSecretId, goCardlessSecretKey)

const getBanksForCountryCode = async (countryCode?: string) => {
  if (!countryCode) {
    countryCode = await input({
      message: 'CountryCode?',
      required: true,
      validate: (str: string) => str.length === 2,
    })
  }

  return goCardless.getListOfBanks(countryCode)
}

const addBank = async (db: Db, bankName: string, bankId: string) => {
  const reqRef = await goCardless.getRequisitionRef(bankId, bankName)
  const accounts = await goCardless.listAccounts(reqRef)

  const endUserAgreementValidTill = new Date()
  endUserAgreementValidTill.setDate(endUserAgreementValidTill.getDate() + 90) // valid for 90 days

  await db.addBank({
    name: bankName,
    id: bankId,
    reqRef,
    accounts,
    endUserAgreementValidTill: endUserAgreementValidTill.toISOString(),
  })
}

const reconnectBank = async (db: Db, bankName: string) => {
  const bank = await db.getBankByName(bankName)

  const reqRef = await goCardless.getRequisitionRef(bank.id, bankName)
  const accounts = await goCardless.listAccounts(reqRef)

  const endUserAgreementValidTill = new Date()
  endUserAgreementValidTill.setDate(endUserAgreementValidTill.getDate() + 90) // valid for 90 days

  await db.updateBankByName(bankName, {
    reqRef,
    accounts,
    endUserAgreementValidTill: endUserAgreementValidTill.toISOString(),
  })
  console.log(`[${bankName}]`, 'reconnected')
}

const fileExists = async (path: string): Promise<boolean> => {
  return new Promise(async (resolve) => {
    try {
      await fs.access(path)
      resolve(true)
    } catch (err) {
      if ((err as any)?.code === 'ENOENT') {
        resolve(false)
      } else {
        throw err
      }
    }
  })
}

const getCsvForBank = async (db: Db, bankName: string): Promise<void> => {
  console.log(`[${bankName}]`, 'Getting csv')
  const bank = await db.getBankByName(bankName)

  if (
    !bank.endUserAgreementValidTill ||
    new Date(bank.endUserAgreementValidTill) < new Date()
  ) {
    // endUserAgreement expired, have to renew
    await reconnectBank(db, bankName)
    return getCsvForBank(db, bankName)
  }

  const yesterday = new Date()

  // Normalize yesterday's date to midnight
  yesterday.setHours(0, 0, 0, 0)
  yesterday.setTime(yesterday.getTime() - yesterday.getTimezoneOffset() * 60000)

  yesterday.setDate(yesterday.getDate() - 1)

  const dateFrom = bank.importedTill ? new Date(bank.importedTill) : new Date(0)
  dateFrom.setDate(dateFrom.getDate() + 1) // start importing from the next day

  let fileName = bankName.replaceAll(':', '.')
  fileName += `.${dateFrom.toISOString().split('T')[0].replaceAll('-', '')}`
  fileName += `-${yesterday.toISOString().split('T')[0].replaceAll('-', '')}`
  fileName += '.grabber.csv'

  const fullPath = path.join(location, fileName)
  if (await fileExists(fullPath)) {
    throw new Error(`File already exists: ${fullPath}`)
  }

  if (dateFrom > yesterday) {
    console.log(`[${bankName}]`, 'No new dates to import')
    return
  }

  const transactions = (
    await Promise.all(
      bank.accounts.map((account) =>
        goCardless.listTransations(account, dateFrom, yesterday),
      ),
    )
  )
    .map((t) => t.booked)
    .flat()

  const forCsv = transactions.map((transaction) => {
    let currency = transaction.transactionAmount.currency
    if (
      transaction.currencyExchange &&
      transaction.transactionAmount.currency !== 'EUR'
    ) {
      currency += ` @ ${1 / Number(transaction.currencyExchange.exchangeRate)} ${transaction.currencyExchange.sourceCurrency}`
    }
    return {
      id: transaction.transactionId,
      date: transaction.bookingDate,
      amount: Number(transaction.transactionAmount.amount).toFixed(2),
      currency,
      payee:
        Number(transaction.transactionAmount.amount) > 0
          ? transaction.debtorName
          : transaction.creditorName,
      narration:
        transaction.remittanceInformationUnstructured ??
        transaction.remittanceInformationUnstructuredArray?.join('\n'),
      bankTransactionCode:
        transaction.bankTransactionCode ??
        transaction.proprietaryBankTransactionCode,
    }
  })

  if (forCsv.length === 0) {
    console.log(`[${bankName}]`, 'No new data.')
  } else {
    const csv = stringify([
      Object.keys(forCsv[0]),
      ...forCsv.map((c) => Object.values(c)),
    ])
    await fs.writeFile(fullPath, csv)
    console.log(`[${bankName}]`, 'Csv written to', fullPath)
  }

  await db.updateBankByName(bankName, {
    importedTill: yesterday.toISOString().split('T')[0],
  })
}

const getCsvForGroup = async (db: Db, groupName: string): Promise<void> => {
  const banks = await db.getBanksInGroup(groupName)
  await Promise.all(banks.map((bank) => getCsvForBank(db, bank.name)))
}

const addBanksToGroup = async (
  db: Db,
  groupName?: string,
  bankNamesToAdd?: string[],
) => {
  if (!groupName) {
    groupName = await select({
      message: `What group to add to?`,
      choices: (await db.getGroups()).map((group) => ({
        name: group.name,
        value: group.name,
      })),
    })
  }

  const group = await db.getGroupByName(groupName)
  if (!bankNamesToAdd || bankNamesToAdd.length > 0) {
    await db.updateGroupByName(groupName, {
      bankNames: { ...group.bankNames, ...bankNamesToAdd },
    })
  } else {
    const answer = await checkbox({
      message: `Banks to add to group "${groupName}"`,
      choices: (await db.getBanks()).map((bank) => ({
        name: bank.name,
        value: bank.name,
        disabled: group.bankNames.includes(bank.name)
          ? 'already in group'
          : false,
      })),
    })
    if (answer.length > 0) {
      await db.updateGroupByName(groupName, {
        bankNames: [...group.bankNames, ...answer],
      })
    }
  }
}

export const listBanks = async (_db: Db, countryCode?: string) => {
  const banks = await getBanksForCountryCode(countryCode)
  console.log(`Bank name: Bank id`)
  console.log('---------------------')
  banks.forEach((bank) => {
    console.log(`${bank.name}: ${bank.id}`)
  })
}
export const listAddedBanks = async (db: Db) => {
  const banks = await db.getBanks()
  console.log(banks.map((bank) => bank.name).join('\n'))
}

export const addBankAction = async (
  db: Db,
  bankName?: string,
  bankId?: string,
) => {
  if (!bankName) {
    bankName = await input({ message: 'Bank name?', required: true })
  }

  if (!bankId) {
    bankId = await select({
      message: `Bank id?`,
      choices: (await getBanksForCountryCode()).map((bank) => ({
        name: bank.name,
        value: bank.id,
      })),
    })
  }

  await addBank(db, bankName, bankId)
}

export const addGroup = async (db: Db, groupName?: string) => {
  if (!groupName) {
    groupName = await input({ message: 'Group name?', required: true })
  }

  await db.addGroup({ name: groupName, bankNames: [] })
}

export const addBanksToGroupAction = async (
  db: Db,
  groupName?: string,
  bankNames?: string[],
) => {
  await addBanksToGroup(db, groupName, bankNames)
}

export const reconnectBankAction = async (db: Db, bankName?: string) => {
  if (!bankName) {
    bankName = await select({
      message: `What bank to reconnect?`,
      choices: (await db.getBanks()).map((bank) => ({
        name: bank.name,
        value: bank.name,
      })),
    })
  }

  await reconnectBank(db, bankName)
}

export const getCsvAction = async (
  db: Db,
  getGroups: boolean | null,
  bankOrGroupName?: string,
) => {
  if (getGroups === null) {
    const answer = await select({
      message: `Select banks or groups?`,
      choices: [
        { name: 'banks', value: 'banks' },
        { name: 'groups', value: 'groups' },
      ],
    })
    getGroups = answer === 'groups'
  }

  if (!bankOrGroupName) {
    const selectOptions = getGroups ? await db.getGroups() : await db.getBanks()

    bankOrGroupName = await select({
      message: `What ${getGroups ? 'group' : 'bank'} to get csv for?`,
      choices: selectOptions.map((option) => ({
        name: option.name,
        value: option.name,
      })),
    })
  }
  if (getGroups) {
    await getCsvForGroup(db, bankOrGroupName)
  } else {
    await getCsvForBank(db, bankOrGroupName)
  }
}
