const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const NodeCache = require('node-cache');

const app = express();
app.use(cors()); // Enable CORS for local testing

const cache = new NodeCache({ stdTTL: 3600 }); // Cache TTL of 1 hour

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html')); // Serves index.html as the homepage
});

// Handle favicon requests
app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, 'favicon.ico'));
});


// List of websites and metadata
const websites = {
    "麥田影院": { url: "https://www.mtyy1.com/vodsearch/-------------.html?wd={}", selector: "div.public-list-div a.public-list-exp", base_url: "https://www.mtyy1.com" },
    "奈飛": { url: "https://www.naifei1.org/vodsearch.html?wd={}", selector: "div.module-search-item div.video-info a.video-serial", base_url: "https://www.naifei1.org/"},
    "如意資源": { url: "https://www.ryzyw.com/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.ryzyw.com" },
    "非凡資源": { url: "http://ffzy2.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "http://ffzy1.tv" },
    "紅牛資源": { url: "https://hongniuzy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://hongniuzy.com" },
    "豪華資源": { url: "https://hhzyapi.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://hhzyapi.com"},
    "光速資源": { url: "https://guangsuzy.net/index.php/vod/search.html?wd={}", selector: "table.tb tbody tr td.yp a", base_url: "https://guangsuzy.net" },
    "金鷹資源": { url: "https://jyzyapi.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://jyzyapi.com" },
    "速播資源": { url: "https://www.subozy.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://www.subozy.com" },
    "虎牙資源": { url: "https://huyazy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://huyazy.com" },
    "極速資源": { url: "https://www.jisuzy.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://www.jisuzy.com" },
    "臥龍資源": { url: "https://www.wolongzy.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.wolongzy.tv" },
    "天空資源": { url: "https://tiankongzy.cc/index.php/vod/search.html?wd={}", selector: "ul li span.xing_vb4 a", base_url: "https://tiankongzy.cc" },
    "華為吧資源": { url: "https://nikanba.live/index.php/vod/search.html?wd={}", selector: "ul li span.xing_vb4 a", base_url: "https://nikanba.live" },
    "黑木耳資源": { url: "https://www.heimuer.tv/index.php/vod/search.html?wd={}", selector: "ul.stui-vodlist li a", base_url: "https://www.heimuer.tv" },
};

// Function to scrape the page and extract URLs
const scrapePage = async (url, baseUrl, selector, query) => {
    try {
        const fullUrl = url.replace('{}', query); // Replace {} with the query
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        };

        const response = await axios.get(fullUrl, { headers });
        const $ = cheerio.load(response.data);

        // Use the selector to find the links
        const results = $(selector).map((i, el) => {
            const href = $(el).attr('href');
            return href ? new URL(href, baseUrl).href : null;
        }).get();

        // Filter out unwanted links
        return results.filter(link => link && !link.includes('/type/id/'));
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        return [];
    }
};

// Search endpoint
app.get('/search', async (req, res) => {
    const query = req.query.query; // Get the 'query' parameter
    if (!query) {
        return res.status(400).json({ error: "Query parameter is missing" });
    }

    const cachedResults = cache.get(query);
    if (cachedResults) {
        return res.json(cachedResults); // Return cached results if available
    }

    try {
        const results = await Promise.all(
            Object.entries(websites).map(([name, metadata]) =>
                scrapePage(metadata.url, metadata.base_url, metadata.selector, query)
                    .then(links => ({ [name]: links }))
            )
        );
        const combinedResults = Object.assign({}, ...results);
        cache.set(query, combinedResults); // Cache the results
        res.json(combinedResults);
    } catch (error) {
        res.status(500).json({ error: "An error occurred during the search" });
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

