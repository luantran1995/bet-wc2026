const https = require('https');
const fs = require('fs');

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.7,en;q=0.3'
      }
    };
    https.get(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve(body);
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    const html = await fetchHtml('https://www.flashscore.vn/');
    fs.writeFileSync('flashscore.html', html);
    console.log('Saved flashscore.html. Size:', html.length);
    
    // Find all urls starting with https:// and containing .com or .ninja or .ir
    const matches = html.match(/https:\/\/[a-zA-Z0-9.\-_/]+/g) || [];
    console.log('Found', matches.length, 'URLs');
    const uniqueUrls = Array.from(new Set(matches));
    console.log('Unique URLs (first 30):');
    console.log(uniqueUrls.slice(0, 30).join('\n'));
    
    // Search for window.config or similar script variables
    const scriptBlocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    console.log('Found', scriptBlocks.length, 'script tags');
    scriptBlocks.forEach((block, idx) => {
      if (block.includes('config') || block.includes('feed') || block.includes('init') || block.includes('window.')) {
        console.log(`Script block ${idx} snippet:`, block.substring(0, 300));
      }
    });
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
