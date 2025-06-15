const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cors = require('cors');
const path = require('path');

// Add stealth plugin
puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, "public")));


// Base headers configuration
const baseHeaders = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1'
};

// User agents for rotation
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1'
];


// Static routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/favicon.ico', (req, res) => res.sendFile(path.join(__dirname, 'favicon.ico')));

// Website configurations
const websites = {
  "🔍 P.Dog": {url: "https://ylsp.tv/vodsearch/-------------/?wd={}", selector: "div.module-card-item.module-item div.module-card-item-title a", base_url: "https://ylsp.tv"},
  "🔍 如意": { url: "https://www.ryzyw.com/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://www.ryzyw.com" },
  "🔍 豆瓣": {url: "https://www.dbzy.com/vodsearch/-------------.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://www.dbzy.com"},
  "🔍 臥龍": { url: "https://wolongzyw.tv/index.php/vod/search.html?wd={}", selector: "ul.videoContent li a.videoName", base_url: "https://wolongzyw.tv" },
  "🔍 魔爪": {url: "https://mzzy.me/index.php/vod/search.html?wd={}", selector: "div.wrap table tbody tr td a", base_url: "https://mzzy.me"},
  "🔍 紅牛": { url: "https://hongniuzy.tv/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://hongniuzy.tv" },
  "🔍 豪華": { url: "https://hhzyapi.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://hhzyapi.com" },
  "🔍 光速": { url: "https://guangsuzy.net/index.php/vod/search.html?wd={}", selector: "table.tb tbody tr td.yp a", base_url: "https://guangsuzy.net" },
  "🔍 金鷹": { url: "https://jyzyapi.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://jyzyapi.com" },
  "🔍 速播": { url: "https://www.subozy.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://www.subozy.com" },
  "🔍 虎牙": { url: "https://huyazy.com/index.php/vod/search.html?wd={}", selector: "div.xing_vb span.xing_vb4 a", base_url: "https://huyazy.com" },
  "🔍 極速": { url: "https://www.jisuzy.com/index.php/vod/search.html?wd={}", selector: "div.list div.list-item span.list-title a", base_url: "https://www.jisuzy.com" },
  "🔍 黑木耳": { url: "https://www.heimuer.tv/index.php/vod/search.html?wd={}", selector: "ul.stui-vodlist li a", base_url: "https://www.heimuer.tv" },
};

// New Puppeteer scraping function
const scrapeWithPuppeteer = async (url, selector, baseUrl) => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: "new", 
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    });
	
    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Block unnecessary resources
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'script'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`Navigating to ${url}...`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Add random delays between actions
    await page.waitForTimeout(1000 + Math.random() * 2000);
    
    // Scroll page to trigger lazy-loaded content
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Extract links
    return await page.$$eval(selector, (elements, baseUrl) => {
      return elements.map(el => {
        const href = el.getAttribute('href');
        try {
          return href ? new URL(href, baseUrl).href : null;
        } catch {
          return null;
        }
      }).filter(link => link && !link.includes('/type/id/'));
    }, baseUrl);

  } catch (error) {
    console.error(`Puppeteer error on ${url}:`, error.message);
    return [];
  } finally {
    if (browser) await browser.close();
  }
};

// Update your scrapePage function
const scrapePage = async (url, baseUrl, selector, query, retries = 3) => {
  try {
    const fullUrl = url.replace('{}', encodeURIComponent(query));
    console.log(`Scraping: ${fullUrl}`);
    
    const links = await scrapeWithPuppeteer(fullUrl, selector, baseUrl);
    console.log(`Found ${links.length} links from ${url.split('/')[2]}`);
    return links;
    
  } catch (error) {
    if (retries > 0) {
      console.log(`Retrying (${retries} left) for ${url.split('/')[2]}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return scrapePage(url, baseUrl, selector, query, retries - 1);
    }
    console.error(`Scrape failed for ${url.split('/')[2]}:`, error.message);
    return [];
  }
};

// Concurrent task processor with rate limiting
async function processConcurrently(tasks, concurrency = 3) {
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
      await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
    }
  }

  return Promise.all(results);
}

// SSE endpoint with error handling
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

    await processConcurrently(tasks, 3); // Reduced concurrency for stability
  } catch (error) {
    console.error('Search error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
  } finally {
    res.end();
  }
});

// Server setup
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Available user agents:', userAgents.length);
});

// Server timeout configuration
server.setTimeout(15000, (socket) => {
  console.log("Request timed out");
  socket.end('HTTP/1.1 408 Request Timeout\r\n\r\n');
});