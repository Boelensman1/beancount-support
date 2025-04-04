import csv
import decimal
import re
from os import path
from beangulp import mimetypes
from beangulp.importers import csvbase
from beangulp.testing import main

def parseAbnNarration(transactionType, narration):
    narrationSplit = narration.splitlines()
    if narrationSplit[0].startswith('BEA'):
        return re.sub(r' {2,}', ' ',re.sub(r',([^\d ])',', \1',narrationSplit[1])).strip() + ", " + narrationSplit[3]

    if narrationSplit[0] == 'SEPA Overboeking' or transactionType == '944' or transactionType == '654' or transactionType =='411':
        match = re.search(r'Omschrijving: ([^:]*)(?:\s*Kenmerk:|$)', narration)
        if match:
            # Split the match result into lines
            lines = match.group(1).splitlines()
            # Strip each line, filter out empty lines, and join with spaces
            result = ''.join(line.strip() for line in lines if line.strip())
            return result
        return narrationSplit[0] # else return the first line


    if transactionType == '526':
        return re.sub(r' +', ' ', ', '.join(narrationSplit))

    # apple pay
    if transactionType == '426' or transactionType == '369':
        return ', '.join(narrationSplit[1:])

    # geldautomaat
    if transactionType == '445':
        return re.sub(r"GEA, ",'',', '.join(narrationSplit))

    raise Exception('Could not parse description', transactionType, narration)


class AbnNarration(csvbase.Columns):
    def parse(self, transactionType, narration):
        return parseAbnNarration(transactionType, narration).replace('\n', ' ')


class Importer(csvbase.Importer):
    dialect = 'csv-grabber'

    date = csvbase.Date('date', '%Y-%m-%d')
    payee = csvbase.Column('payee')
    narration = AbnNarration('bankTransactionCode','narration')
    amount = csvbase.Amount('amount')
    currency = csvbase.Column('currency')


    def identify(self, filepath):
        filename = path.basename(filepath)
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        if not filename.startswith('Assets.NL.ABN.Gezamelijk'):
            return False
        if not filename.endswith('.grabber.csv'):
            return False
        return True

    def filename(self, filepath):
        return path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
