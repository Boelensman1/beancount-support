from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
import re

import requests
from bs4 import BeautifulSoup

from beanprice import source


class MorningstarError(ValueError):
    "An error from the Morningstar API."


class Source(source.Source):
    "Morningstar price extractor."

    def get_latest_price(self, ticker: str) -> Optional[source.SourcePrice]:
        """See contract in beanprice.source.Source."""

        url = f"https://www.morningstar.nl/nl/funds/snapshot/snapshot.aspx?id={ticker}"

        try:
            response = requests.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            table = soup.find('table', {'class': 'overviewKeyStatsTable'})

            if not table:
                raise MorningstarError(f"Could not find price data for ticker {ticker}")

            # Find the price row (first row after header)
            price_row = table.find_all('tr')[1]
            price_cells = price_row.find_all('td')

            # Extract date and price
            date_match = re.search(r'(\d{2}-\d{2}-\d{4})', price_cells[0].text)
            if not date_match:
                raise MorningstarError(f"Could not parse date for ticker {ticker}")

            date_str = date_match.group(1)
            trade_time = datetime.strptime(date_str, '%d-%m-%Y').replace(tzinfo=timezone.utc)

            # Extract price and currency
            price_text = price_cells[2].text.strip()
            currency_match = re.match(r'([A-Z]{3})\s*([\d,\.]+)', price_text)
            if not currency_match:
                raise MorningstarError(f"Could not parse price for ticker {ticker}")

            currency = currency_match.group(1)
            price_str = currency_match.group(2).replace(',', '.')
            price = Decimal(price_str)

            return source.SourcePrice(price, trade_time, currency)

        except requests.RequestException as exc:
            raise MorningstarError(f"Failed to fetch data for {ticker}: {exc}") from exc
