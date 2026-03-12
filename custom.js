const axios = require('axios');
const fs = require('fs');
const xml2js = require('xml2js');

async function fetchSitemapAndUpdateJson() {
    const jsonFilePath = 'productPageUrls.json';

    // Hardcode the brands and their sitemap URLs here
    const brandsToProcess = [
        {
            brand: 'allthingsbeauty',
            domain: 'ph',
            sitemapUrl: 'https://www.allthingsbeauty.com/ph/sitemap.products-product-page-sitemap.xml',
            feedUrl: 'https://www.allthingsbeauty.com/ph/home.productfeed.json',
            assortmentCode: 'PH'
        },
        // Add more brands here as needed
        // {
        //     brand: 'allthingsbeauty',
        //     domain: 'id',
        //     sitemapUrl: 'https://www.allthingsbeauty.com/id/sitemap.products-product-page-sitemap.xml',
        //     feedUrl: 'https://www.allthingsbeauty.com/id/home.productfeed.json',
        //     assortmentCode: 'ID'
        // }
    ];

    try {
        // Read the existing JSON file
        const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));

        for (const brandConfig of brandsToProcess) {
            console.log(`Processing ${brandConfig.brand} ${brandConfig.domain.toUpperCase()}...`);

            try {
                // Fetch the XML sitemap
                const response = await axios.get(brandConfig.sitemapUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Accept': 'application/xml, text/xml, */*',
                        'Accept-Encoding': 'gzip, deflate, br'
                    },
                    timeout: 30000
                });

                console.log(`Sitemap fetched successfully. Parsing XML...`);

                // Parse the XML
                const parser = new xml2js.Parser();
                const result = await parser.parseStringPromise(response.data);

                // Extract URLs from the <loc> tags
                const urls = [];
                if (result.urlset && result.urlset.url) {
                    for (const urlEntry of result.urlset.url) {
                        if (urlEntry.loc && urlEntry.loc[0]) {
                            urls.push(urlEntry.loc[0]);
                        }
                    }
                }

                console.log(`Found ${urls.length} product URLs in ${brandConfig.domain.toUpperCase()} sitemap`);

                // Find and update the brand entry
                let updated = false;
                for (let i = 0; i < jsonData.data.length; i++) {
                    const entry = jsonData.data[i];
                    if (entry.feedUrl === brandConfig.feedUrl) {
                        console.log(`Found ${brandConfig.brand} ${brandConfig.domain.toUpperCase()} entry. Updating with sitemap URLs...`);
                        entry.productPageUrls = urls;
                        updated = true;
                        break;
                    }
                }

                if (!updated) {
                    console.log(`${brandConfig.brand} ${brandConfig.domain.toUpperCase()} entry not found. Adding new entry...`);
                    // If not found, add a new entry
                    jsonData.data.push({
                        brand: brandConfig.brand,
                        assortmentCode: brandConfig.assortmentCode,
                        feedUrl: brandConfig.feedUrl,
                        productPageUrls: urls
                    });
                }

            } catch (domainError) {
                console.error(`Error processing ${brandConfig.brand} ${brandConfig.domain.toUpperCase()}:`, domainError.message);
                // Continue with other brands
            }
        }

        // Update totals
        jsonData.totalUrls = jsonData.data.reduce((sum, entry) => sum + entry.productPageUrls.length, 0);
        jsonData.generatedAt = new Date().toISOString();

        // Write back to file
        fs.writeFileSync(jsonFilePath, JSON.stringify(jsonData, null, 2));
        console.log('productPageUrls.json updated successfully!');
        console.log(`Total URLs now: ${jsonData.totalUrls}`);

    } catch (error) {
        console.error('Error reading or writing JSON file:', error.message);
    }
}

// Run the function
fetchSitemapAndUpdateJson();