const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

async function fetchPageContent(url) {
  try {

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    const html = await res.text();

    const dom = new JSDOM(html);
    const document = dom.window.document;

    const widget = document.querySelector('[data-ref="cartwire-bin-widget"]');

    return {
      brandCode: widget?.getAttribute("data-brand-code"),
      locale: widget?.getAttribute("data-locale"),
      brandName: widget?.getAttribute("data-nltx-brand-name")
    };

  } catch (err) {
    throw err;
  }
}

function extractGtinFromUrl(url) {

  const gtinPatterns = [
    /[/-](\d{12,14})[/-]/,
    /gtin[=:](\d{12,14})/i,
    /(\d{12,14})(?:\.html|\/)/,
    /\.html\/(\d{12,14})/
  ];

  for (const pattern of gtinPatterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

async function searchForBinErrorScript(widgetData, pageUrl) {

  const gtin = extractGtinFromUrl(pageUrl);

  if (!gtin) {
    return {
      found: false,
      gtin: null,
      reason: "GTIN not found"
    };
  }

  const apiUrl =
    `https://bin.cartwire.co/services/hashlanginfobutton?brand_name=${widgetData.brandName}&locale=${widgetData.locale}&brand_code=${widgetData.brandCode}&gtin=${gtin}`;

  const response = await fetch(apiUrl);
  const scriptText = await response.text();

  const match = scriptText.match(/console\.log\("([^"]+)"\)/);

  const expectedMessage =
    `There is a problem with one of the products Buy It Now (BIN) button on this Product Page. BIN button is not working because Widget is inActive for GTIN : ${gtin}. Please reach out to Cartwire Team.`;

  if (match && match[1] === expectedMessage) {
    return {
      found: true,
      gtin,
      url: pageUrl
    };
  }

  return {
    found: false,
    gtin
  };
}

async function processUrl(url, index, total) {

  try {

    process.stdout.write(
      `\r[${index + 1}/${total}] Checking: ${url.substring(0, 70)}...`
    );

    const widgetData = await fetchPageContent(url);

    const result = await searchForBinErrorScript(widgetData, url);

    if (result.found) {
      return {
        type: "problematic",
        url,
        gtin: result.gtin,
        checkedAt: new Date().toISOString()
      };
    }

    return {
      type: "successful",
      url,
      gtin: result.gtin,
      checkedAt: new Date().toISOString()
    };

  } catch (err) {

    return {
      type: "error",
      url,
      error: err.message,
      checkedAt: new Date().toISOString()
    };

  }
}

async function main() {

  try {

    const productUrlsFile = path.join(process.cwd(), "productPageUrls.json");

    if (!fs.existsSync(productUrlsFile)) {
      throw new Error(`File not found: ${productUrlsFile}`);
    }

    const productData = JSON.parse(
      fs.readFileSync(productUrlsFile, "utf8")
    );

    const urls = productData.data.flatMap(e => e.productPageUrls);

    console.log(`Total URLs: ${urls.length}\n`);

    const results = [];

    const batchSize = 25;

    for (let i = 0; i < urls.length; i += batchSize) {

      const batch = urls.slice(i, i + batchSize);

      const promises = batch.map((url, idx) =>
        processUrl(url, i + idx, urls.length)
      );

      const batchResults = await Promise.all(promises);

      results.push(...batchResults);

    }

    const problematic = results.filter(r => r.type === "problematic");
    const successful = results.filter(r => r.type === "successful");
    const errors = results.filter(r => r.type === "error");

    console.log("\n\n==============================");
    console.log("FINAL SUMMARY");
    console.log("==============================");

    console.log(`Total URLs Checked: ${results.length}`);
    console.log(`Problematic Pages: ${problematic.length}`);
    console.log(`Successful Pages: ${successful.length}`);
    console.log(`Errors: ${errors.length}`);

    fs.writeFileSync(
      "pdpCheckResults.json",
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        total: results.length,
        problematic,
        successful,
        errors
      }, null, 2)
    );

    console.log("\nResults saved to pdpCheckResults.json");

  } catch (err) {

    console.error("Error:", err.message);

  }

}

if (require.main === module) main();