const TAVILY_SEARCH_ENDPOINT = "https://api.tavily.com/search";
const SEARCH_TIMEOUT_MS = 15_000;
const MAX_RESULTS = 5;
const MAX_CONTENT_LENGTH = 2_500;

export type WebSource = {
  title: string;
  url: string;
};

type TavilyResult = {
  title?: unknown;
  url?: unknown;
  content?: unknown;
};

type TavilyResponse = {
  results?: unknown;
};

export class TavilySearchError extends Error {
  status: number;

  constructor(status: number, detail?: string) {
    super(detail || `Tavily returned HTTP ${status}`);
    this.name = "TavilySearchError";
    this.status = status;
  }
}

export function getTavilyApiKey(value: string | undefined) {
  if (!value) return null;

  let normalized = value.trim();

  for (let index = 0; index < 3; index += 1) {
    if (
      normalized.length >= 2 &&
      ((normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'")))
    ) {
      normalized = normalized.slice(1, -1).trim();
    }

    normalized = normalized
      .replace(/^TAVILY_API_KEY\s*=\s*/i, "")
      .replace(/^Bearer\s+/i, "")
      .trim();
  }

  return /^tvly-[^\s"']+$/.test(normalized) ? normalized : null;
}

async function getErrorDetail(response: Response) {
  const text = await response.text().catch(() => "");
  if (!text) return undefined;

  try {
    const payload = JSON.parse(text) as {
      detail?: string | { error?: unknown };
    };
    if (typeof payload.detail === "string") return payload.detail;
    if (typeof payload.detail?.error === "string") return payload.detail.error;
  } catch {
    // The status code remains sufficient when Tavily returns a non-JSON body.
  }

  return text.slice(0, 300);
}

function getSafeHttpUrl(value: unknown) {
  if (typeof value !== "string") return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function searchWeb(query: string, apiKey: string) {
  const response = await fetch(TAVILY_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      topic: "general",
      // Tavily rejects safe_search with fast and ultra-fast search depths.
      // Basic has the same one-credit cost while keeping safe search enabled.
      search_depth: "basic",
      chunks_per_source: 2,
      max_results: MAX_RESULTS,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      safe_search: true,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new TavilySearchError(
      response.status,
      await getErrorDetail(response),
    );
  }

  const payload = (await response.json()) as TavilyResponse;
  const candidates = Array.isArray(payload.results)
    ? (payload.results as TavilyResult[])
    : [];

  const results = candidates.flatMap((candidate) => {
    if (typeof candidate !== "object" || candidate === null) return [];

    const url = getSafeHttpUrl(candidate.url);
    const title =
      typeof candidate.title === "string" ? candidate.title.trim() : "";
    const content =
      typeof candidate.content === "string" ? candidate.content.trim() : "";

    if (!url || !content) return [];

    return [
      {
        title: (title || new URL(url).hostname).slice(0, 180),
        url,
        content: content.slice(0, MAX_CONTENT_LENGTH),
      },
    ];
  }).slice(0, MAX_RESULTS);

  if (results.length === 0) {
    throw new Error("Tavily returned no usable search results");
  }

  return {
    sources: results.map(({ title, url }) => ({ title, url })),
    context: JSON.stringify(
      results.map(({ title, url, content }, index) => ({
        index: index + 1,
        title,
        url,
        content,
      })),
    ),
  };
}
