import csv
import decimal
import re
from os import path
from beangulp import mimetypes
from beangulp.importers import csvbase
from beangulp.testing import main

csv.register_dialect(
    'amex',
    delimiter=',',
    quotechar='"',
    quoting=csv.QUOTE_MINIMAL,
    lineterminator='\r\n'
)

class AmexAmount(csvbase.Column):
    """Specialized Amount class for handling Dutch number formats with comma as decimal separator."""

    def parse(self, value):
        # Replace comma with dot and remove any whitespace
        normalized_value = value.strip().replace(',', '.')  # Replace comma with dot
        return -decimal.Decimal(normalized_value)


# Register correct dialect
class Importer(csvbase.Importer):
    dialect = 'amex'

    date = csvbase.Date('Datum', '%m/%d/%Y')
    amount = AmexAmount('Bedrag')
    narration = csvbase.Column('Omschrijving')

    def identify(self, filepath):
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        with open(filepath, encoding='utf-8-sig') as fd:
            head = fd.read(1024)
        return head.startswith("Datum,Omschrijving,Bedrag,Aanvullende informatie,Vermeld op uw rekeningoverzicht als,Adres,Plaats,Postcode,Land,Referentie")


    def filename(self, filepath):
        return 'amex.' + path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
