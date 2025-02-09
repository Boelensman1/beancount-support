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
csv.register_dialect('ing', delimiter=';', quoting=csv.QUOTE_MINIMAL)

class IngAmount(csvbase.Columns):
    """Specialized Amount class for handling Dutch number formats with comma as decimal separator."""

    def parse(self, value, debitOrCredit):
        # Replace comma with dot and remove any whitespace
        normalized_value = value.strip().replace(',', '.')  # Replace comma with dot
        value = decimal.Decimal(normalized_value)
        return value if debitOrCredit == 'Credit' else -value

def parseIngNarration(transactionType, name, notifications):
        if transactionType in ['iDEAL', 'SEPA direct debit', 'Batch payment', 'Transfer', 'Online Banking']:
            match = re.search(r"^Name: (.*)Description: (.*) IBAN: ", notifications)
            if match:
                payee = match.group(1).strip()
                narration = match.group(2).strip()

                if narration.startswith(payee):
                    narration = narration[len(payee):].strip()
                return payee, narration
        if transactionType == 'Online Banking':
            match = re.search(r'^(?:From|To) (.*) (Value .*)', notifications)
            if match:
                payee = match.group(1).strip()
                narration = match.group(2).strip()
                return payee, narration

        if transactionType == 'Various':
            return None, name

        if transactionType == 'Payment terminal':
            return name, notifications

        raise Exception('Could not parse description', transactionType, name, notifications)

class IngNarrationOrPayee(csvbase.Columns):
    def __init__(self, ca,cb,cc, returnNarration=True):
        super().__init__(ca,cb,cc)
        self.returnNarration = returnNarration

    def parse(self, transactionType,name, notifications):
        payee, narration = parseIngNarration(transactionType, name, notifications)
        return narration if self.returnNarration else payee


class Importer(csvbase.Importer):
    dialect = 'ing'

    date = csvbase.Date('Date', '%Y%m%d')
    payee = IngNarrationOrPayee('Transaction type','Name / Description','Notifications', returnNarration=False)
    narration = IngNarrationOrPayee('Transaction type','Name / Description','Notifications', returnNarration=True)

    amount = IngAmount('Amount (EUR)', 'Debit/credit')


    def identify(self, filepath):
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        with open(filepath) as fd:
            head = fd.read(1024)
        return head.startswith('"Date";"Name / Description";"Account";"Counterparty";"Code";"Debit/credit";"Amount (EUR)";"Transaction type";"Notifications";"Resulting balance";"Tag"')

    def filename(self, filepath):
        return 'ing.' + path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
