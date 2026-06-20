import { search } from "duck-duck-scrape";
async function test() {
  try {
    const res = await search("test search");
    console.log("DDG results:", res.results.length);
  } catch (err) {
    console.error("DDG error:", err);
  }
}
test();
