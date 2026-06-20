import { parse as parseHTML } from "node-html-parser";

// ─── Types ───────────────────────────────────────────────────────────

export interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

interface SearXNGResult {
  readonly title?: string;
  readonly url?: string;
  readonly content?: string;
}

interface SearXNGResponse {
  readonly results?: readonly SearXNGResult[];
}

// ─── Constants ───────────────────────────────────────────────────────

const SEARCH_TIMEOUT_MS = 15000;
const DDG_URL = "https://html.duckduckgo.com/html/";
const DDG_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ─── Public API ──────────────────────────────────────────────────────

export async function searchWeb(
  query: string,
  searxngUrl: string,
  maxResults: number,
): Promise<readonly SearchResult[]> {
  try {
    const results = await searchSearXNG(query, searxngUrl);
    if (results.length > 0) {
      return results.slice(0, maxResults);
    }
  } catch {
    // SearXNG unavailable — fall through to DuckDuckGo
  }

  try {
    const results = await searchDuckDuckGo(query);
    return results.slice(0, maxResults);
  } catch {
    // Both search providers failed
    return [];
  }
}

// ─── SearXNG ─────────────────────────────────────────────────────────

export async function searchSearXNG(
  query: string,
  baseUrl: string,
): Promise<readonly SearchResult[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `${baseUrl}/search?q=${encodedQuery}&format=json`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`SearXNG responded with status ${response.status}`);
  }

  const data = (await response.json()) as SearXNGResponse;
  const rawResults = data.results ?? [];

  return rawResults
    .filter(isValidSearXNGResult)
    .map(mapSearXNGResult);
}

function isValidSearXNGResult(result: SearXNGResult): boolean {
  return Boolean(result.title && result.url);
}

function mapSearXNGResult(result: SearXNGResult): SearchResult {
  return {
    title: (result.title ?? "").trim(),
    url: (result.url ?? "").trim(),
    snippet: (result.content ?? "").trim(),
  };
}

// ─── DuckDuckGo HTML Fallback ────────────────────────────────────────

export async function searchDuckDuckGo(
  query: string,
): Promise<readonly SearchResult[]> {
  const formBody = `q=${encodeURIComponent(query)}`;

  const response = await fetch(DDG_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": DDG_USER_AGENT,
    },
    body: formBody,
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo responded with status ${response.status}`);
  }

  const html = await response.text();
  return parseDuckDuckGoResults(html);
}

function parseDuckDuckGoResults(html: string): readonly SearchResult[] {
  const root = parseHTML(html);
  const resultElements = root.querySelectorAll(".result");

  const results: SearchResult[] = [];

  for (const element of resultElements) {
    const parsed = parseSingleDDGResult(element);
    if (parsed) {
      results.push(parsed);
    }
  }

  return results;
}

function parseSingleDDGResult(
  element: ReturnType<ReturnType<typeof parseHTML>["querySelector"]>,
): SearchResult | null {
  if (!element) return null;

  const linkElement = element.querySelector(".result__a");
  const snippetElement = element.querySelector(".result__snippet");

  if (!linkElement) return null;

  const title = linkElement.textContent.trim();
  const rawHref = linkElement.getAttribute("href") ?? "";
  const url = extractDDGUrl(rawHref);
  const snippet = snippetElement?.textContent.trim() ?? "";

  if (!title || !url) return null;

  return { title, url, snippet };
}

function extractDDGUrl(rawHref: string): string {
  // DDG wraps URLs in a redirect: //duckduckgo.com/l/?uddg=ENCODED_URL&...
  try {
    if (rawHref.includes("uddg=")) {
      const urlObj = new URL(rawHref, "https://duckduckgo.com");
      const decoded = urlObj.searchParams.get("uddg");
      return decoded ?? rawHref;
    }
    // Direct URL
    if (rawHref.startsWith("http")) {
      return rawHref;
    }
    return rawHref;
  } catch {
    return rawHref;
  }
}
