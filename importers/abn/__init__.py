import csv
import decimal
import re
from os import path
from beangulp import mimetypes
from beangulp.importers import csvbase
from beangulp.testing import main

csv.register_dialect(
    'abn',
    delimiter=';',
    quotechar='"',
    quoting=csv.QUOTE_MINIMAL,
    lineterminator='\r\n'
)

class AbnAmount(csvbase.Column):
    """Specialized Amount class for handling Dutch number formats with comma as decimal separator."""

    def parse(self, value):
        # Replace comma with dot and remove any whitespace
        normalized_value = value.strip().replace(',', '.')  # Replace comma with dot
        return decimal.Decimal(normalized_value)

class AbnDescription(csvbase.Column):
    def parse(self, value):
        if value.startswith('ABN AMRO Bank N.V.'):
            return re.sub(r' {2,}',' ', value).strip()
        if value.startswith('BEA'):
            match = re.search(r'^([\w,.]+ )*.  +(.*)', value.strip())
            if match:
                return re.sub(r' {2,}', ' ',re.sub(r',([^\d ])',', \1',match.group(2))).strip()
        if value.startswith('SEPA'):
            match = re.search(r'Naam: (.*)Omschrijving: (.*) Kenmerk', value.strip())
            if match:
                name = match.group(1)
                description = match.group(2)
                return name.strip() + ", " + description.strip()
        if value.startswith('/TRTP/'):
            match = re.search(r'\/NAME\/([^\/]*)\/.*\/?REMI\/([^\/]*)\/',value.strip())
            if match:
                name = match.group(1)
                remi = match.group(2)
                return name + ", " + remi

        raise Exception('Could not parse description', value)

# Register correct dialect
class Importer(csvbase.Importer):
    dialect = 'abn'

    date = csvbase.Date('Transactiedatum', '%Y%m%d')
    amount = AbnAmount('Transactiebedrag')
    narration = AbnDescription('Omschrijving')

    def identify(self, filepath):
        mimetype, encoding = mimetypes.guess_type(filepath)
        if mimetype != 'text/csv':
            return False
        with open(filepath, encoding='utf-8-sig') as fd:
            head = fd.read(1024)
        return head.startswith("Rekeningnummer;Muntsoort;Transactiedatum;Rentedatum;Beginsaldo;Eindsaldo;Transactiebedrag;Omschrijving")


    def filename(self, filepath):
        return 'abn.' + path.basename(filepath)


#if __name__ == '__main__':
#    main(Importer('Assets:NL:ING:Checking', 'EUR'))
