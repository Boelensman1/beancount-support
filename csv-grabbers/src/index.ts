import { program } from 'commander'

import Db from './Db.js'
import {
  listBanks,
  listAddedBanks,
  addBankAction,
  addGroup,
  addBanksToGroupAction,
  reconnectBankAction,
  getCsvAction,
} from './actions.js'

const db = new Db()

program
  .name('csv-grabber')
  .description('CLI to grab transactions from banks')
  .version('0.0.1')

program
  .command('list-banks')
  .description('List all connectable banks in a specific country')
  .argument('[countrycode]', 'countrycode')
  .action(listBanks.bind(null, db))

program
  .command('list-added-banks')
  .description('List all added banks')
  .action(listAddedBanks.bind(null, db))

program
  .command('add-bank')
  .description('Add a bank')
  .argument('[bankName]', 'bankName')
  .argument('[bankId]', 'bank id')
  .action(addBankAction.bind(null, db))

program
  .command('add-group')
  .description('Add a group')
  .argument('[groupName]', 'groupName')
  .action(addGroup.bind(null, db))

program
  .command('add-banks-to-group')
  .description('Add banks to group')
  .argument('[groupName]', 'groupName')
  .argument('[bankNames...]', 'bankNames to add to the group')
  .action(addBanksToGroupAction.bind(null, db))

program
  .command('reconnect-bank')
  .description('Reconnect an already added bank')
  .argument('[bankName]', 'bankName')
  .action(reconnectBankAction.bind(null, db))

program
  .command('get-csv')
  .description('Get a csv file')
  .argument('[bank or group]', 'bank name or group')
  .option('-g, --group', 'get csv for a bank')
  .option('-b, --bank', 'get csv for a group')
  .action((bankOrGroupName, options) => {
    if (options.group && options.bank) {
      throw new Error('Options --group and --bank are mutually exclusive.')
    }

    return getCsvAction(
      db,
      // null if no options are given, otherwise wether we should get groups
      options.bank ? false : options.group ?? null,
      bankOrGroupName,
    )
  })

db.init().then(() => {
  program.parse()
})

process.on('uncaughtException', (err) => {
  if (process.env.DEBUG) {
    throw err
  }
  console.error(`Error: ${err.message}`)
  process.exit(1)
})
