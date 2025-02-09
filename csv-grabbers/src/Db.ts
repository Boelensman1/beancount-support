import type { Low } from 'lowdb'
import { JSONFilePreset } from 'lowdb/node'

interface Bank {
  name: string
  id: string
  reqRef: string
  accounts: string[]
  importedTill?: string
  endUserAgreementValidTill?: string
}

interface Group {
  name: string
  bankNames: string[]
}

interface IDb {
  banks: Bank[]
  groups: Group[]
}

class DB {
  idb?: Low<IDb>

  async init() {
    this.idb = await JSONFilePreset<IDb>('db.json', { banks: [], groups: [] })
  }

  async addBank(bank: Bank) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    await this.idb.read()

    // check for conflicts
    try {
      await this.getBankByName(bank.name)

      throw new Error(`A bank with name "${bank.name}" already exists`)
    } catch (err) {
      /* an error is the desired behaviour */
    }

    await this.idb.update(({ banks }) =>
      banks.push({
        name: bank.name,
        id: bank.id,
        reqRef: bank.reqRef,
        accounts: bank.accounts,
        endUserAgreementValidTill: bank.endUserAgreementValidTill,
      }),
    )
  }

  async getBankByName(name: string) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    await this.idb.read()
    const bank = this.idb.data.banks.find((bank) => bank.name === name)
    if (!bank) {
      throw new Error(`No bank with name "${name}" found, was it added?`)
    }

    return bank
  }

  async updateBankByName(name: string, updates: Partial<Bank>) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    const bank = await this.getBankByName(name)
    const bankIndex = this.idb.data.banks.findIndex(
      (bank) => bank.name === name,
    )
    await this.idb.update(
      ({ banks }) =>
        (banks[bankIndex] = {
          ...bank,
          ...updates,
        }),
    )
  }

  async getBanks() {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    return this.idb.data.banks
  }

  async getGroups() {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    return this.idb.data.groups
  }

  async addGroup(group: Group) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    await this.idb.read()

    // check for conflicts
    try {
      await this.getGroupByName(group.name)

      throw new Error(`A group with name "${group.name}" already exists`)
    } catch (err) {
      /* an error is the desired behaviour */
    }

    await this.idb.update(({ groups }) =>
      groups.push({
        name: group.name,
        bankNames: group.bankNames,
      }),
    )
  }

  async getGroupByName(name: string) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    await this.idb.read()

    const group = this.idb.data.groups.find((group) => group.name === name)
    if (!group) {
      throw new Error(`No group with name "${name}" found, was it added?`)
    }

    return group
  }

  async updateGroupByName(name: string, updates: Partial<Group>) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    if (updates.bankNames) {
      // verify bankNames
      await Promise.all(
        updates.bankNames.map((bankName) => this.getBankByName(bankName)),
      )
    }

    const group = await this.getGroupByName(name)
    const groupIndex = this.idb.data.groups.findIndex(
      (group) => group.name === name,
    )
    await this.idb.update(
      ({ groups }) =>
        (groups[groupIndex] = {
          ...group,
          ...updates,
          // de-duplicate bankNames
          bankNames: [...new Set(updates.bankNames ?? [])],
        }),
    )
  }

  async getBanksInGroup(name: string) {
    if (!this.idb) {
      throw new Error('Db was not initialised')
    }

    await this.idb.read()

    const group = await this.getGroupByName(name)
    return Promise.all(
      group.bankNames.map((bankName) => this.getBankByName(bankName)),
    )
  }
}

export default DB
