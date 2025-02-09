import csv
import decimal
import re
from os import path
from beangulp import mimetypes
from beangulp.importers import csvbase
from beangulp.testing import main

csv.register_dialect(
    'revolut',
    delimiter=',',
    quotechar='"',
    quoting=csv.QUOTE_MINIMAL,
    lineterminator='\r\n'
)

class RevolutNarrationPayee(csvbase.Columns):
    """Class for handling narration and payee details from Revolut CSV export."""

    def __init__(self, name1, name2, flag='narration'):
        super().__init__(name1, name2)
        self.flag = flag  # Flag to determine whether to return payee or narration

    def split_description(self, description, reference):
        if reference is None:
            return description, None
        else:
            payee = description.replace('Aan ', '').replace('Geld toegevoegd van ', '').strip()
            return reference, payee

    def parse(self, description, reference):
        description, payee = self.split_description(description, reference)
        if self.flag == 'payee':
            return payee
        else:  # default to narration
            return description

# Register correct dialect
class Importer(csvbase.Importer):
    dialect = 'revolut'

    date = csvbase.Date('Date completed (UTC)', '%Y-%m-%d')
    amount = csvbase.Amount('Amount')
    narration = RevolutNarrationPayee('Description','Reference', flag='narration')
    payee = RevolutNarrationPayee('Description','Reference', flag='payee')

    def identify(self, filepath):
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        with open(filepath, encoding='utf-8-sig') as fd:
            head = fd.read(1024)
        return head.startswith("Date started (UTC),Date completed (UTC),ID,Type,Description,Reference,Payer,Card number,Orig currency,Orig amount,Payment currency,Amount,Fee,Balance,Account,Beneficiary account number,Beneficiary sort code or routing number,Beneficiary IBAN,Beneficiary BIC")


    def filename(self, filepath):
        return 'revolut.' + path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
