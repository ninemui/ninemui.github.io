const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html directly
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve favicon.ico directly
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, "favicon.ico"));
});

// Website configuration
const websites = {
	"🔍 鹹魚": { url: "https://www.jxw888.cn/?wd={}", selector: "a.card", base_url: "https://www.jxw888.cn" },
    "🔍 獨播庫": { url: "https://www.dbku.tv/vodsearch/-------------.html?wd={}", selector: "li.clearfix a.searchkey", base_url: "https://www.dbku.tv" },
    "🔍 茅台": { url: "https://mtzy.me/vod/mysearch.html?wd={}", selector: "table.center tbody tr td a", base_url: "https://mtzy.me" },
    "🔍 豆瓣": { url: "https://www.dbzy1.com/vodsearch/-------------.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://www.dbzy1.com" },
    "🔍 紅牛": { url: "https://hongniuzy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://hongniuzy.com" },
    "🔍 西瓜": { url: "https://xgzy.tv/index.php/vod/search.html?wd={}", selector: "td.py-2.px-2.w-12 a", base_url: "https://xgzy.tv"},
    "🔍 電影天堂": { url: "https://dyttzyw.tv/index.php/vod/search.html?wd={}", selector: "tbody tr a.group", base_url: "https://dyttzyw.tv" },
    "🔍 如意": { url: "https://www.ryzyw.com/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.ryzyw.com" },
    "🔍 櫻花": { url: "https://yhzy.cc/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://yhzy.cc" },
    "🔍 貓眼": { url: "https://www.maoyanzy.com/index.php/vod/search.html?wd={}", selector: "a.this-link.flex[href]:not([href='javascript:'])", base_url: "https://www.maoyanzy.com" },
    "🔍 非凡": { url: "http://ffzy1.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "http://ffzy1.tv" },
    "🔍 u酷": { url: "https://ukuzy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://ukuzy.com" },
	"🔍 天涯": { url: "https://tyyszyapi.com/index.php/vod/search.html?wd={}", selector: "a.movie-card", base_url: "https://tyyszyapi.com" },
};

// Updated scrapePage with per-site timeout
const scrapePage = async (siteName, url, baseUrl, selector, query) => {
    try {
        const fullUrl = url.replace('{}', encodeURIComponent(query));

        // Custom timeout per site
        const timeouts = {
            "🔍 西瓜": 3000,     // need 9 seconds for 西瓜
        };

        const timeoutMs = timeouts[siteName] || 3000;   // Default 9 seconds

        const controller = new AbortController();

        const response = await Promise.race([
            axios.get(fullUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                },
                signal: controller.signal
            }),
            new Promise((_, reject) =>
                setTimeout(() => {
                    controller.abort();
                    reject(new Error(`Request timed out after ${timeoutMs}ms`));
                }, timeoutMs)
            )
        ]);

        const $ = cheerio.load(response.data);
       
        return $(selector).map((i, el) => {
            const href = $(el).attr('href');
            return href ? new URL(href, baseUrl).href : null;
        }).get().filter(link => link && !link.includes('/type/id/'));

    } catch (error) {
        console.error(`Scrape error: ${siteName} - ${error.message}`);
        return [];
    }
};

// Concurrent task processor
async function processConcurrently(tasks, concurrency = 4) {
    const results = [];
    const executing = new Set();
    for (const task of tasks) {
        const wrapped = task().then(result => {
            executing.delete(wrapped);
            return result;
        });
        executing.add(wrapped);
        results.push(wrapped);
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    return Promise.all(results);
}

// SSE endpoint
app.get('/search', async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const tasks = Object.entries(websites).map(([name, meta]) => () =>
            scrapePage(name, meta.url, meta.base_url, meta.selector, query)   // ← Fixed here
                .then(links => {
                    res.write(`data: ${JSON.stringify({ [name]: links })}\n\n`);
                    return true;
                })
        );

        await processConcurrently(tasks, 4);
    } catch (error) {
        console.error('Search error:', error);
    } finally {
        res.end();
    }
});

// Server setup
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
);

// Increased overall server timeout to 15 seconds (15000 ms)
server.setTimeout(15000);   
