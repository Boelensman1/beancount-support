#!/usr/bin/env python3
import re
import sys
import os

# needed to make fava able to run this file
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from importers import ing, abn, revolut, amex, ing_from_grabber, revolut_from_grabber, revolut_bv_from_grabber, abn_from_grabber, abn_bv_from_grabber

from beancount.core import data
import beangulp


importers = [
    ing.Importer("Assets:NL:ING:Checking", "EUR"),
    ing_from_grabber.Importer("Assets:NL:ING:Checking", "EUR"),
    abn.Importer("Assets:NL:ABN:Checking", "EUR"),
    abn_from_grabber.Importer("Assets:NL:ABN:Gezamelijk", "EUR"),
    abn_bv_from_grabber.Importer("Assets:BV:ABN:Checking", "EUR"),
    amex.Importer("Liabilities:NL:AMEX", "EUR"),
    revolut.Importer("Assets:BV:Revolut", "EUR"),
    revolut_from_grabber.Importer("Assets:NL:Revolut", "EUR"),
    revolut_bv_from_grabber.Importer("Assets:BV:Revolut", "EUR"),
]

def remove_non_printing_chars(s):
    return re.sub(r'[\x00-\x1F\x7F-\x9F]', '', s)

def clean_up(extracted_entries):
    """clean up cruft.

    Args:
      extracted_entries: A list of directives.
    Returns:
      A new list of directives with possibly modified payees and narration
      fields.
    """
    clean_entries = []
    for entry in extracted_entries:
        if isinstance(entry, data.Transaction):
            # Remove new lines from narration
            narration = remove_non_printing_chars(getattr(entry, 'narration', ''))
            payee = getattr(entry, 'payee', None)
            if payee:
                if len(payee.split(' via ')) == 2:
                    payee = payee.split(' via ')[0]

            entry = entry._replace(narration=narration, payee=payee)
        clean_entries.append(entry)
    return clean_entries


def process_extracted_entries(extracted_entries_list, ledger_entries):
    """Process extracted entries to modify payees and clean descriptions.

    Args:
      extracted_entries_list: A list of (filename, entries) pairs, where
        'entries' are the directives extract from 'filename'.
      ledger_entries: If provided, a list of directives from the existing
        ledger of the user. This is non-None if the user provided their
        ledger file as an option.
    Returns:
      A possibly different version of extracted_entries_list, a list of
      (filename, entries), to be printed.
    """
    return [(filename, clean_up(entries), account, importer)
            for filename, entries, account, importer in extracted_entries_list]


hooks = [process_extracted_entries]


if __name__ == '__main__':
    ingest = beangulp.Ingest(importers, hooks)
    ingest()
