import google from 'googlethis';

async function test() {
  try {
    const options = {
      page: 0, 
      safe: false, // Safe Search
      additional_params: { 
        hl: 'en' 
      }
    }
    const response = await google.search('test search', options);
    console.log("Google results:", response.results.length);
  } catch (err) {
    console.error("Google error:", err);
  }
}
test();
