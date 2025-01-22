import os
from flask import Flask, request, jsonify, send_file, send_from_directory
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for local testing

# Root route
@app.route('/')
def home():
    return send_file('index.html')  # Serves index.html as the homepage

# Handle favicon requests
@app.route('/favicon.ico')
def favicon():
    return send_from_directory('.', 'favicon.ico')

# List of websites and metadata
websites = {
    "麥田影院": {"url": "https://www.mtyy1.com/vodsearch/-------------.html?wd={}","selector": "div.public-list-div a.public-list-exp","base_url": "https://www.mtyy1.com"},
    "如意資源": {"url": "https://www.ryzyw.com/index.php/vod/search.html?wd={}", "selector": "ul.videoContent li a.videoName", "base_url": "https://www.ryzyw.com"},
    "非凡資源": {"url": "http://ffzy1.tv/index.php/vod/search.html?wd={}", "selector": "ul.videoContent li a.videoName", "base_url": "http://ffzy1.tv"},
    "紅牛資源": {"url": "https://hongniuzy.com/index.php/vod/search.html?wd={}", "selector": "div.xing_vb span.xing_vb4 a", "base_url": "https://hongniuzy.com"},
    "光速資源": {"url": "https://guangsuzy.net/index.php/vod/search.html?wd={}", "selector": "table.tb tbody tr td.yp a", "base_url": "https://guangsuzy.net"},
    "金鷹資源": {"url": "https://jyzyapi.com/index.php/vod/search.html?wd={}", "selector": "div.xing_vb span.xing_vb4 a", "base_url": "https://jyzyapi.com"},
    "速播資源": {"url": "https://www.subozy.com/index.php/vod/search.html?wd={}", "selector": "div.list div.list-item span.list-title a", "base_url": "https://www.subozy.com"},
    "虎牙資源": {"url": "https://huyazy.com/index.php/vod/search.html?wd={}", "selector": "div.xing_vb span.xing_vb4 a", "base_url": "https://huyazy.com"},
    "極速資源": {"url": "https://www.jisuzy.com/index.php/vod/search.html?wd={}", "selector": "div.list div.list-item span.list-title a", "base_url": "https://www.jisuzy.com"},
    "臥龍資源": {"url": "https://www.wolongzy.tv/index.php/vod/search.html?wd={}", "selector": "ul.videoContent li a.videoName", "base_url": "https://www.wolongzy.tv"},
    "天空資源": {"url": "https://tiankongzy.cc/index.php/vod/search.html?wd={}", "selector": "ul li span.xing_vb4 a", "base_url": "https://tiankongzy.cc"},
    "華為吧資源": {"url": "https://nikanba.live/index.php/vod/search.html?wd={}", "selector": "ul li span.xing_vb4 a", "base_url": "https://nikanba.live"},
    "黑木耳資源": {"url": "https://www.heimuer.tv/index.php/vod/search.html?wd={}", "selector": "ul.stui-vodlist li a", "base_url": "https://www.heimuer.tv"},
    "暴風資源": {"url": "https://bfzy.tv/s/?keys={}", "selector": "ul.videoContent li a.videoName", "base_url": "https://bfzy.tv"},
}

# Function to scrape the page and extract URLs
def scrape_page(url, base_url, selector, query):
    try:
        # Construct the full URL for the search query
        full_url = url.format(query)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9"
        }
        response = requests.get(full_url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # Use the selector to find the links
        results = soup.select(selector)
        links = [urljoin(base_url, result['href']) for result in results if result.get('href')]

        # Filter out unwanted links
        valid_links = [link for link in links if '/type/id/' not in link]
        return valid_links
    except requests.exceptions.RequestException as e:
        print(f"Error scraping {url}: {e}")
        return []

# Search endpoint
@app.route('/search')
def search():
    query = request.args.get('query')  # Get the 'query' parameter
    if not query:
        return jsonify({"error": "Query parameter is missing"}), 400

    results = {}
    for name, metadata in websites.items():
        links = scrape_page(metadata['url'], metadata['base_url'], metadata['selector'], query)
        results[name] = links

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
