# Product URL Fetch

Simple Node script to fetch `productPageUrl` values from the Dove product feed.

Usage:

```bash
node index.js
# or
npm start
```

The script fetches `https://www.dove.com/uk/home.productfeed.json`, searches for all `productPageUrl` keys recursively, and prints unique values to stdout.
