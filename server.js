const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors()); // Enable CORS for local testing

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
    //"麥田": { url: "https://www.mtyy1.com/vodsearch/-------------.html?wd={}", selector: "div.public-list-div a.public-list-exp", base_url: "https://www.mtyy1.com" },
    "奈飛": { url: "https://www.naifei1.org/vodsearch.html?wd={}", selector: "div.module-search-item div.video-info a.video-serial", base_url: "https://www.naifei1.org/" },
    "如意": { url: "https://www.ryzyw.com/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.ryzyw.com" },
	"豆瓣": {url: "https://www.dbzy.com/vodsearch/-------------.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://www.dbzy.com"},
    "臥龍": { url: "https://www.wolongzy.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.wolongzy.tv" },
    "非凡": { url: "http://ffzy2.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "http://ffzy2.tv" },
	"魔爪": {url: "https://mzzy.me/index.php/vod/search.html?wd={}", selector: "div.notice table tbody tr td a", base_url: "https://mzzy.me"},
    "紅牛": { url: "https://hongniuzy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://hongniuzy.com" },
    "豪華": { url: "https://hhzyapi.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://hhzyapi.com" },
    //"華為吧": { url: "https://huawei8.live/index.php/vod/search.html?wd={}", selector: "ul li span.xing_vb4 a", base_url: "https://nikanba.live" },
    "光速": { url: "https://guangsuzy.net/index.php/vod/search.html?wd={}", selector: "table.tb tbody tr td.yp a", base_url: "https://guangsuzy.net" },
    "金鷹": { url: "https://jyzyapi.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://jyzyapi.com" },
    "速播": { url: "https://www.subozy.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://www.subozy.com" },
    "虎牙": { url: "https://huyazy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://huyazy.com" },
    "極速": { url: "https://www.jisuzy.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://www.jisuzy.com" },
    "天空": { url: "https://tiankongzy.cc/index.php/vod/search.html?wd={}", selector: "ul li span.xing_vb4 a", base_url: "https://tiankongzy.cc" },
    "黑木耳": { url: "https://www.heimuer.tv/index.php/vod/search.html?wd={}", selector: "ul.stui-vodlist li a", base_url: "https://www.heimuer.tv" },
};

// Function to scrape the page and extract URLs with timeout
const scrapePage = async (url, baseUrl, selector, query, timeout = 4000) => {
    const fetchWithTimeout = (url, options, timeout) => {
        return Promise.race([
            axios.get(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout))
        ]);
    };

    try {
        const fullUrl = url.replace('{}', query); // Replace {} with the query
        const headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        };

        const response = await fetchWithTimeout(fullUrl, { headers }, timeout); // 4s timeout for each request
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

// SSE endpoint for real-time search results
app.get('/search', (req, res) => {
    const query = req.query.query; // Get the 'query' parameter
    if (!query) {
        return res.status(400).json({ error: "Query parameter is missing" });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send results as they are found
    Object.entries(websites).forEach(async ([name, metadata]) => {
        const links = await scrapePage(metadata.url, metadata.base_url, metadata.selector, query, 4000);
        res.write(`data: ${JSON.stringify({ [name]: links })}\n\n`); // Send data to client
    });

    // End the stream when all results are sent
    res.on('close', () => {
        res.end();
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Set server timeout to 8 seconds (8000 ms)
server.setTimeout(8000, (socket) => {
    console.log("Request timed out");
    socket.end('HTTP/1.1 408 Request Timeout\r\n\r\n'); // Send timeout response
});
