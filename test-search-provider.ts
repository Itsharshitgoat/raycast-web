import { searchDuckDuckGo } from "./src/lib/search-provider";

async function run() {
  console.log("Running...");
  try {
    const results = await searchDuckDuckGo("test search");
    console.log("Results:", results.length);
  } catch (e) {
    console.error(e);
  }
}
run();
