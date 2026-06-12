const fs = require('fs');

function searchHtml() {
  const html = fs.readFileSync('flashscore.html', 'utf8');
  console.log('HTML Length:', html.length);
  
  const searchTerms = ['Mexico', 'South Africa', 'South Korea', 'Czech', 'Guadalajara'];
  searchTerms.forEach(term => {
    const idx = html.indexOf(term);
    console.log(`Term "${term}": Found at index ${idx}`);
    if (idx !== -1) {
      console.log(`Snippet around "${term}":`, html.substring(idx - 100, idx + 100));
    }
  });
}

searchHtml();
