const { searchWeb } = require('./build/lib/search-provider.js');

async function test() {
  console.log("Testing search...");
  try {
    const results = await searchWeb("India vs Afghanistan cricket match 20 June 2026 result", "http://localhost:8080", 5);
    console.log("Results length:", results.length);
    console.log(JSON.stringify(results, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
