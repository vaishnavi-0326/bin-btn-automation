const axios = require('axios');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

function findValues(obj, keyName) {
  const results = [];
  function recurse(node) {
    if (Array.isArray(node)) {
      node.forEach(recurse);
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        if (k === keyName) results.push(node[k]);
        recurse(node[k]);
      }
    }
  }
  recurse(obj);
  return results;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    axios({
      method: 'get',
      url: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
        'Connection': 'keep-alive'
      },
      timeout: 20000,
      maxRedirects: 10
    })
      .then((response) => {
        try {
          const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          resolve(parsed);
        } catch (e) {
          reject(new Error(`JSON Parse Error: ${e.message}`));
        }
      })
      .catch((error) => {
        if (error.response && error.response.status) {
          reject(new Error(`Request Failed. Status Code: ${error.response.status}`));
        } else {
          reject(error);
        }
      });
  });
}

function readExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    return data;
  } catch (err) {
    throw new Error(`Failed to read Excel file: ${err.message}`);
  }
}

async function main() {
  try {
    const outArg = process.argv[2];
    const outFile = outArg ? path.resolve(outArg) : path.join(process.cwd(), 'productPageUrls.json');
    const failureFile = path.join(process.cwd(), 'failedBrands.json');
    const sitesExcelFile = path.join(process.cwd(), 'sites.xlsx');

    if (!fs.existsSync(sitesExcelFile)) {
      throw new Error(`Excel file not found: ${sitesExcelFile}`);
    }

    console.log(`Reading Excel file: ${sitesExcelFile}`);
    const sites = readExcelFile(sitesExcelFile);
    
    const results = [];
    const failures = [];
    let totalUrls = 0;

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      const feedUrl = site['Feed JSON URL'];
      const brand = site['Brand'];
      const assortmentCode = site['Assortment Code'];
      const countryLocale = site['Country/Locale'];
      
      if (!feedUrl) {
        console.log(`Row ${i + 1}: Skipped - No Feed JSON URL found`);
        failures.push({
          brand: brand,
          countryLocale: countryLocale,
          assortmentCode: assortmentCode,
          feedUrl: feedUrl,
          reason: 'No Feed JSON URL found',
          timestamp: new Date().toISOString()
        });
        continue;
      }

      try {
        console.log(`[${i + 1}/${sites.length}] Fetching ${feedUrl} ...`);
        const data = await fetchJson(feedUrl);
        const urls = findValues(data, 'productPageUrl');
        
        if (urls.length > 0) {
          const unique = Array.from(new Set(urls));
          results.push({
            brand: brand,
            countryLocale: countryLocale,
            assortmentCode: assortmentCode,
            feedUrl: feedUrl,
            productPageUrls: unique
          });
          totalUrls += unique.length;
          console.log(`  → Found ${unique.length} unique productPageUrl values`);
        } else {
          console.log(`  → No productPageUrl values found`);
          failures.push({
            brand: brand,
            countryLocale: countryLocale,
            assortmentCode: assortmentCode,
            feedUrl: feedUrl,
            reason: 'No productPageUrl values found in feed',
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
        failures.push({
          brand: brand,
          countryLocale: countryLocale,
          assortmentCode: assortmentCode,
          feedUrl: feedUrl,
          reason: err.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log(`\nTotal URLs collected: ${totalUrls}`);
    console.log(`Total failures: ${failures.length}`);
    
    const output = {
      generatedAt: new Date().toISOString(),
      totalBrands: results.length,
      totalUrls: totalUrls,
      data: results,
    };

    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
    console.log(`Saved results to ${outFile}`);

    if (failures.length > 0) {
      const failureOutput = {
        generatedAt: new Date().toISOString(),
        totalFailures: failures.length,
        data: failures
      };

      fs.writeFileSync(failureFile, JSON.stringify(failureOutput, null, 2), 'utf8');
      console.log(`Saved ${failures.length} failures to ${failureFile}`);
    }
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
