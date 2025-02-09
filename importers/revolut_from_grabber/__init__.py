import csv
import decimal
import re
from os import path
from beangulp import mimetypes
from beangulp.importers import csvbase
from beangulp.testing import main

def parseRevolutNarration(transactionType, narration):
    if transactionType == 'TOPUP':
        return ' '.join(narration.split('\n')[1:])
    return narration

class RevolutNarration(csvbase.Columns):
    def parse(self, transactionType, narration):
        return parseRevolutNarration(transactionType, narration).replace('\n', ' ')


class Importer(csvbase.Importer):
    dialect = 'csv-grabber'

    date = csvbase.Date('date', '%Y-%m-%d')
    payee = csvbase.Column('payee')
    narration = RevolutNarration('bankTransactionCode','narration')
    amount = csvbase.Amount('amount')
    currency = csvbase.Column('currency')


    def identify(self, filepath):
        filename = path.basename(filepath)
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        if not filename.startswith('Assets.NL.Revolut'):
            return False
        if not filename.endswith('.grabber.csv'):
            return False
        return True

    def filename(self, filepath):
        return path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
