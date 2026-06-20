import { research } from "./src/lib/research-agent";
async function run() {
  const res = await research("fifa ronaldo match why they lost", {
    searxngUrl: "http://localhost:8080",
    maxResults: 2,
    maxContentLength: 4000,
    maxContextLength: 15000
  });
  console.log("Sources found:", res.sources.length);
  for (const s of res.sources) {
    console.log("Title:", s.title);
    console.log("Content length:", s.content.length);
    console.log("Preview:", s.content.substring(0, 100).replace(/\n/g, " "));
  }
}
run();
