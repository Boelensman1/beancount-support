import inquirer from 'inquirer'
import Db from './Db.js'
import BeancountFile from './BeancountFile.js'
import type {
  AutoPostingPosting,
  AutoPostingMatcher,
  AutoPostingMatcherComposite,
} from './interfaces/IDb.js'
import { PostingLine } from './interfaces/TaggedStrings.js'

const getAutoPostingMatcherPostingsFlow = async (
  db: Db,
  postings: AutoPostingPosting[] = [],
) => {
  if (postings.length > 0) {
    const { continueAdding } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAdding',
        message: 'Add another line?',
      },
    ])

    if (!continueAdding) {
      return postings
    }
  }

  const line = await inquirer.prompt([
    {
      type: 'list',
      name: 'account',
      message: 'account',
      choices: await db.getPostingAccounts(),
    },
    {
      type: 'input',
      name: 'line',
      message: 'Line',
    },
  ])
  postings.push({ ...line, flag: null })

  return getAutoPostingMatcherPostingsFlow(db, postings)
}

const getCompositeMatchOptionsFlow = async (
  defaultValues?: AutoPostingMatcher,
  compositeMatchType?: AutoPostingMatcherComposite['matchType'],
  matchers: AutoPostingMatcher[] = [],
) => {
  if (!compositeMatchType) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'matchType',
        message: 'MatchType?',
        choices: ['any', 'all', 'none'],
      },
    ])
    compositeMatchType = answer.matchType
  }

  if (matchers.length > 0) {
    const { continueAdding } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAdding',
        message: 'Add another matcher?',
      },
    ])

    if (!continueAdding) {
      return { matchType: compositeMatchType, matchers }
    }
  }

  const { matchType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'matchType',
      message: 'Type',
      choices: ['regex', 'composite'],
      default() {
        return defaultValues?.matchType ?? ''
      },
    },
  ])
  const matcher = await getMatchOptionsFlow(matchType)
  matchers.push(matcher)

  return getCompositeMatchOptionsFlow(defaultValues, matchType, matchers)
}

const getMatchOptionsFlow = async (
  matchType: AutoPostingMatcher['matchType'],
  defaultValues?: AutoPostingMatcher,
) => {
  let matchOptions
  switch (matchType) {
    case 'regex':
      const matchOptionsQuestions = [
        {
          type: 'list',
          name: 'matchOn',
          message: 'Match on',
          choices: ['date', 'payee', 'narration', 'amount'],
          default() {
            return defaultValues?.matchType === 'regex'
              ? defaultValues.matchOptions.matchOn
              : ''
          },
        },
        {
          type: 'input',
          name: 'regex',
          message: 'Regex',
          default() {
            return defaultValues?.matchType === 'regex'
              ? defaultValues.matchOptions.regex
              : ''
          },
        },
      ]
      matchOptions = await inquirer.prompt(matchOptionsQuestions)
      break
    case 'composite':
      return getCompositeMatchOptionsFlow(defaultValues)
    default:
      throw new Error('Not implemented')
  }
  return matchOptions
}

const getAutoPostingMatcherOptionsFlow = async (
  db: Db,
  defaultValues?: AutoPostingMatcher,
) => {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Name of the automatcher',
      default() {
        return defaultValues?.name ?? ''
      },
    },
    {
      type: 'list',
      name: 'matchType',
      message: 'Type',
      choices: ['regex', 'composite'],
      default() {
        return defaultValues?.matchType ?? ''
      },
    },
    {
      type: 'number',
      name: 'expectedAmountMin',
      message: 'Minimum expected amount',
      default() {
        return defaultValues?.expectedAmountMin ?? ''
      },
    },
    {
      type: 'number',
      name: 'expectedAmountMax',
      message: 'Maximum expected amount',
      default() {
        return defaultValues?.expectedAmountMax ?? ''
      },
    },
    {
      type: 'input',
      name: 'expectedCurrency',
      message: 'Expected currency',
      default() {
        return defaultValues?.expectedCurrency ?? ''
      },
    },
    {
      type: 'checkbox',
      name: 'expectedAccounts',
      message: 'Make a choice',
      choices: await db.getAccounts(),
      default() {
        return defaultValues?.expectedAccounts ?? []
      },
    },
  ]

  const autoMatcherOptions1 = await inquirer.prompt(questions)

  const matchOptions = await getMatchOptionsFlow(
    autoMatcherOptions1.matchType,
    defaultValues,
  )

  const postings = await getAutoPostingMatcherPostingsFlow(db)

  return { ...autoMatcherOptions1, postings, matchOptions }
}

const addAutoPostingMatcherFlow = async (db: Db) => {
  const autoPostingMatcher = await getAutoPostingMatcherOptionsFlow(db)
  const existing = await db.getAutoPostingMatchers()
  await db.addAutoPostingMatcher(autoPostingMatcher, existing.length) // add to the end
}

const editAutoPostingMatcherFlow = async (db: Db) => {
  const autoPostingMatchers = await db.getAutoPostingMatchers()
  const questions = [
    {
      type: 'list',
      name: 'autoPostingMatcherIndex',
      message: 'Which autoPostingMatcher should be edited',
      choices: autoPostingMatchers.map((apm, i) => ({
        name: apm.name,
        value: i,
      })),
    },
  ]

  const { autoPostingMatcherIndex } = await inquirer.prompt(questions)
  const oldAutoPostingMatcher = autoPostingMatchers[autoPostingMatcherIndex]

  const autoPostingMatcher = await getAutoPostingMatcherOptionsFlow(
    db,
    oldAutoPostingMatcher,
  )

  await db.updateAutoPostingMatcher(
    oldAutoPostingMatcher.name,
    autoPostingMatcher,
  )
}

const removeAccountFlow = async (db: Db) => {
  const questions = [
    {
      type: 'list',
      name: 'name',
      message: 'Name of the account',
      choices: await db.getAccounts(),
    },
  ]

  const { name } = await inquirer.prompt(questions)
  await db.removeAccount(name)
}

const addAccountFlow = async (db: Db) => {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Name of the account',
    },
  ]

  const { name } = await inquirer.prompt(questions)
  await db.addAccount(name)
}

const addPostingAccountFlow = async (db: Db) => {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Name of the posting account',
    },
  ]

  const { name } = await inquirer.prompt(questions)
  await db.addPostingAccount(name)
}

// the main loop
const interactiveMenuFlow = async (db: Db) => {
  const { flow } = await inquirer.prompt({
    type: 'list',
    name: 'flow',
    message: 'Make a choice',
    choices: [
      'addAccount',
      'removeAccount',
      'addPostingAccount',
      'addAutoPostingMatcher',
      'editAutoPostingMatcher',
      'process',
    ],
  })

  switch (flow) {
    case 'addAccount':
      await addAccountFlow(db)
      break
    case 'removeAccount':
      await removeAccountFlow(db)
      break
    case 'addPostingAccount':
      await addPostingAccountFlow(db)
      break
    case 'addAutoPostingMatcher':
      await addAutoPostingMatcherFlow(db)
      break
    case 'editAutoPostingMatcher':
      await editAutoPostingMatcherFlow(db)
      break
    case 'process':
      console.log('Call the program with the input file as its (only) argument')
    default:
      throw new Error('Unknown flow')
  }

  return interactiveMenuFlow(db)
}

const processFileFlow = async (db: Db, fileLocation: string) => {
  const beancountFile = await BeancountFile.createFromFile(fileLocation)
  for (let transaction of beancountFile.transactions) {
    const matchedAutoPostingMatcher = db.matchTransaction(transaction)
    if (matchedAutoPostingMatcher) {
      matchedAutoPostingMatcher.postings.forEach((posting) => {
        transaction.postings.push({
          flag: posting.flag,
          account: posting.account,
          line: eval('`' + posting.line + '`') as PostingLine,
        })
      })
    }
  }

  console.log(beancountFile.toString())
}

const run = async () => {
  const db = await Db.createDb()

  if (process.argv.length > 3) {
    throw new Error('Too  many arguments')
  }
  if (process.argv.length === 3) {
    const inputFileLocation = process.argv[2]
    return processFileFlow(db, inputFileLocation)
  }

  return interactiveMenuFlow(db)
}

run()
