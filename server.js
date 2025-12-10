const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const { setTimeout } = require('timers/promises');

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
	"🔍 永樂視訊": {url: "https://ylsp.tv/vodsearch/-------------/?wd={}", selector: "div.module-card-item.module-item div.module-card-item-title a", base_url: "https://ylsp.tv"},
	"🔍 看片狂人": { url: "https://kpkuang.one/vodsearch/-------------.html?wd={}", selector: "div.uk-card-header a", base_url: "https://kpkuang.one" },
	"🔍 電影天堂": { url: "https://dyttzyw.tv/index.php/vod/search.html?wd={}", selector: "tbody tr a.group", base_url: "https://dyttzyw.tv" },
	"🔍 非凡": { url: "http://ffzy1.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "http://ffzy1.tv" },
	"🔍 天涯": { url: "https://tyyszyapi.com/index.php/vod/search.html?wd={}", selector: "ul.stui-vodlist.clearfix a", base_url: "https://tyyszyapi.com" },
	"🔍 豆瓣": { url: "https://www.dbzy1.com/vodsearch/-------------.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://www.dbzy1.com" },
	"🔍 臥龍": { url: "https://wolongzyw.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://wolongzyw.tv" },
	"🔍 u酷": { url: "https://ukuzy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://ukuzy.com" },	
	"🔍 淘片": { url: "https://www.taopianzy.com/search.html?keyword={}", selector: "tbody tr td.fontleft.txleft span.fontbule a", base_url: "https://www.taopianzy.com" },
	"🔍 茅台": { url: "https://mtzy.me/vodsearch/-------------.html?wd={}", selector: "table.center tbody tr td a", base_url: "http://mtzy.me" },
	"🔍 如意": { url: "https://www.ryzyw.com/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.ryzyw.com" },
    "🔍 魔爪": { url: "https://mzzy.me/index.php/vod/search.html?wd={}", selector: "div.wrap table tbody tr td a", base_url: "https://mzzy.me" },
	"🔍 金鷹": { url: "https://jyzyapi.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://jyzyapi.com" },
    "🔍 紅牛": { url: "https://hongniuzy.tv/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://hongniuzy.tv" },



};

// Function to scrape the page and extract URLs with timeout
const scrapePage = async (url, baseUrl, selector, query) => {
    try {
        const fullUrl = url.replace('{}', encodeURIComponent(query));
        const controller = new AbortController();
        
        const response = await Promise.race([
            axios.get(fullUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                signal: controller.signal
            }),
            setTimeout(4000).then(() => {
                controller.abort();
                throw new Error('Request timed out');
            })
        ]);

        const $ = cheerio.load(response.data);
        return $(selector).map((i, el) => {
            const href = $(el).attr('href');
            return href ? new URL(href, baseUrl).href : null;
        }).get().filter(link => link && !link.includes('/type/id/'));

    } catch (error) {
        console.error(`Scrape error: ${url.split('/')[2]} - ${error.message}`);
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

// SSE endpoint with concurrency control
app.get('/search', async (req, res) => {
    const query = req.query.query;
    if (!query) return res.status(400).json({ error: "Missing query parameter" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const tasks = Object.entries(websites).map(([name, meta]) => () => 
            scrapePage(meta.url, meta.base_url, meta.selector, query)
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

// Set server timeout to 10 seconds (10000 ms)
server.setTimeout(10000, (socket) => {
    console.log("Request timed out");
    socket.end('HTTP/1.1 408 Request Timeout\r\n\r\n'); // Send timeout response
});
