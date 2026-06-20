import { searchWeb } from "./search-provider";
import { fetchAndExtract } from "./content-extractor";
import type { SearchResult } from "./search-provider";

// ─── Types ───────────────────────────────────────────────────────────

export interface ResearchSource {
  readonly title: string;
  readonly url: string;
  readonly content: string;
}

export interface ResearchContext {
  readonly query: string;
  readonly sources: readonly ResearchSource[];
  readonly contextText: string;
}

export interface ResearchOptions {
  readonly searxngUrl: string;
  readonly maxResults: number;
  readonly maxContentLength: number;
  readonly maxContextLength?: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_MAX_CONTEXT_LENGTH = 15000;
const SOURCE_SEPARATOR = "\n\n";

// ─── Public API ──────────────────────────────────────────────────────

export async function research(
  query: string,
  options: ResearchOptions,
): Promise<ResearchContext> {
  const maxContextLength =
    options.maxContextLength ?? DEFAULT_MAX_CONTEXT_LENGTH;

  const searchResults = await searchWeb(
    query,
    options.searxngUrl,
    options.maxResults,
  );

  if (searchResults.length === 0) {
    return { query, sources: [], contextText: "" };
  }

  const sources = await crawlAndExtract(searchResults, options.maxContentLength);
  const deduped = deduplicateByUrl(sources);
  const contextText = buildContextText(deduped, maxContextLength);

  return { query, sources: deduped, contextText };
}

// ─── Crawl & Extract ─────────────────────────────────────────────────

async function crawlAndExtract(
  searchResults: readonly SearchResult[],
  maxContentLength: number,
): Promise<readonly ResearchSource[]> {
  const crawlPromises = searchResults.map((result) =>
    crawlSingleResult(result, maxContentLength),
  );

  const settled = await Promise.allSettled(crawlPromises);

  const sources: ResearchSource[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled" && result.value !== null) {
      sources.push(result.value);
    }
  }

  return sources;
}

async function crawlSingleResult(
  result: SearchResult,
  maxContentLength: number,
): Promise<ResearchSource | null> {
  const extracted = await fetchAndExtract(result.url, maxContentLength);

  if (!extracted || extracted.content.trim().length === 0) {
    // Fall back to the search snippet if the page couldn't be crawled
    if (result.snippet.trim().length > 0) {
      return {
        title: result.title,
        url: result.url,
        content: result.snippet,
      };
    }
    return null;
  }

  return {
    title: extracted.title || result.title,
    url: result.url,
    content: extracted.content,
  };
}

// ─── Deduplication ───────────────────────────────────────────────────

function deduplicateByUrl(
  sources: readonly ResearchSource[],
): readonly ResearchSource[] {
  const seen = new Set<string>();
  const unique: ResearchSource[] = [];

  for (const source of sources) {
    const normalizedUrl = normalizeUrl(source.url);
    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      unique.push(source);
    }
  }

  return unique;
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove trailing slash and fragment for dedup purposes
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}${parsed.search}`;
  } catch {
    return url.toLowerCase().trim();
  }
}

// ─── Context Building ────────────────────────────────────────────────

function buildContextText(
  sources: readonly ResearchSource[],
  maxContextLength: number,
): string {
  const blocks: string[] = [];
  let totalLength = 0;

  for (const source of sources) {
    const block = formatSourceBlock(source);
    const blockLength = block.length + SOURCE_SEPARATOR.length;

    if (totalLength + blockLength > maxContextLength) {
      // Try to fit a truncated version of this block
      const remainingBudget =
        maxContextLength - totalLength - SOURCE_SEPARATOR.length;
      if (remainingBudget > 200) {
        const truncatedBlock = truncateSourceBlock(source, remainingBudget);
        blocks.push(truncatedBlock);
      }
      break;
    }

    blocks.push(block);
    totalLength += blockLength;
  }

  return blocks.join(SOURCE_SEPARATOR);
}

function formatSourceBlock(source: ResearchSource): string {
  return [
    `--- Source: ${source.title} (${source.url}) ---`,
    source.content,
  ].join("\n");
}

function truncateSourceBlock(
  source: ResearchSource,
  maxLength: number,
): string {
  const header = `--- Source: ${source.title} (${source.url}) ---\n`;
  const contentBudget = maxLength - header.length;

  if (contentBudget <= 0) return header.trim();

  const truncatedContent = source.content.slice(0, contentBudget) + "…";
  return header + truncatedContent;
}
