from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
import re

import requests
from bs4 import BeautifulSoup

from beanprice import source


class FTError(ValueError):
    "An error from the Financial Times API."


class Source(source.Source):
    "Financial Times price extractor."

    def get_latest_price(self, ticker: str) -> Optional[source.SourcePrice]:
        """See contract in beanprice.source.Source."""

        url = f"https://markets.ft.com/data/funds/tearsheet/summary?s={ticker}:eur"

        try:
            response = requests.get(url)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, 'html.parser')
            quote_bar = soup.find('ul', {'class': 'mod-tearsheet-overview__quote__bar'})

            if not quote_bar:
                raise FTError(f"Could not find price data for ticker {ticker}")

            # Extract price
            price_item = quote_bar.find('li')
            if not price_item:
                raise FTError(f"Could not find price element for ticker {ticker}")
            
            price_value = price_item.find('span', {'class': 'mod-ui-data-list__value'})
            if not price_value:
                raise FTError(f"Could not find price value for ticker {ticker}")
            
            price = Decimal(price_value.text.strip())

            # Extract date
            disclaimer = soup.find('div', {'class': 'mod-disclaimer'})
            if not disclaimer:
                raise FTError(f"Could not find date information for ticker {ticker}")
            
            date_match = re.search(r'as of ([A-Za-z]+ \d{2} \d{4})', disclaimer.text)
            if not date_match:
                raise FTError(f"Could not parse date for ticker {ticker}")

            trade_time = datetime.strptime(date_match.group(1), '%b %d %Y').replace(tzinfo=timezone.utc)

            # Currency is always EUR based on the URL structure
            currency = 'EUR'

            return source.SourcePrice(price, trade_time, currency)

        except requests.RequestException as exc:
            raise FTError(f"Failed to fetch data for {ticker}: {exc}") from exc
