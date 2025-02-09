import csv
import decimal
import re
from os import path
from beangulp import mimetypes
from beangulp.importers import csvbase
from beangulp.testing import main

class StaticColumn(csvbase.Column):
    """A column that returns a static value."""
    def __init__(self, value):
        self.value = value
        self.names = []

    def parse(self):
        return self.value

# Register correct dialect
csv.register_dialect('csv-grabber', delimiter=',', quotechar='"', doublequote=True,
                     skipinitialspace=True, lineterminator='\n', quoting=csv.QUOTE_MINIMAL)


def parseIngNarration(transactionType, narration):
    if transactionType in ['iDEAL','Verzamelbetaling', 'Incasso', 'Overschrijving', 'Online bankieren']:
        match = re.search(r"^Naam: (.*)<br>Omschrijving:(.*)<br>IBAN: (.*?)<br>", narration)
        if match:
            payee = match.group(1).strip()
            narration = match.group(2).strip()

            if narration.startswith(payee):
                narration = narration[len(payee):].strip()

            if transactionType == 'Online bankieren':
                narration = match.group(3) + " - " + match.group(2)

            return narration
    if transactionType == 'Betaalautomaat':
        return ''

    if transactionType in ['Diversen','Online bankieren','Overschrijving', 'Geldautomaat']:
        if narration.startswith('Van') or narration.startswith('Naar'):
            return ''

        match = re.search(r"(.*?)(?:<br>Datum\/Tijd:.*)?<br>Valutadatum:.*", narration)
        if match:
            narration= match.group(1).strip()
            return narration

    if transactionType == 'Payment terminal':
        return narration

    raise Exception('Could not parse description', transactionType, narration)

class IngNarration(csvbase.Columns):
    def parse(self, transactionType, narration):
        return parseIngNarration(transactionType, narration).replace("<br>", " ").strip()


class Importer(csvbase.Importer):
    dialect = 'csv-grabber'

    date = csvbase.Date('date', '%Y-%m-%d')
    payee = csvbase.Column('payee')
    narration = IngNarration('bankTransactionCode','narration')
    amount = csvbase.Amount('amount')
    currency = csvbase.Column('currency')


    def identify(self, filepath):
        filename = path.basename(filepath)
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        if not filename.startswith('Assets.NL.ING.Checking'):
            return False
        if not filename.endswith('.grabber.csv'):
            return False
        return True

    def filename(self, filepath):
        return path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
