import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type Language = "ar" | "en";
type MyMemoryResponse = {
  responseData?: { translatedText?: string };
  responseDetails?: string;
  responseStatus?: number;
};

const MAX_SEGMENT_BYTES = 450;
const CACHE_LIMIT = 500;

function sourceLanguage(text: string): Language {
  const arabic = (text.match(/[\u0600-\u06ff]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  return arabic >= latin && arabic > 0 ? "ar" : "en";
}

function splitUtf8(text: string, maxBytes = MAX_SEGMENT_BYTES): string[] {
  const remaining = [...text];
  const chunks: string[] = [];
  while (remaining.length) {
    let bytes = 0;
    let end = 0;
    let lastBoundary = 0;
    while (end < remaining.length) {
      const size = Buffer.byteLength(remaining[end], "utf8");
      if (bytes + size > maxBytes) break;
      bytes += size;
      end += 1;
      if (/\s|[.!?،؛:]/u.test(remaining[end - 1])) lastBoundary = end;
    }
    if (end === remaining.length) {
      chunks.push(remaining.join(""));
      break;
    }
    const cut = lastBoundary >= Math.floor(end * 0.55) ? lastBoundary : end;
    chunks.push(remaining.splice(0, cut).join(""));
  }
  return chunks;
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };
  return value
    .replace(/&(amp|lt|gt|quot|apos);|&#39;/g, (entity) => named[entity] || entity)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

@Injectable()
export class TranslationService {
  private readonly cache = new Map<string, string>();

  constructor(private readonly config: ConfigService) {}

  async translate(text: string, target: Language) {
    const cleanText = text.trim();
    const source = sourceLanguage(cleanText);
    if (!cleanText || source === target) {
      return { translatedText: cleanText, sourceLanguage: source, targetLanguage: target };
    }

    const cacheKey = `${source}:${target}:${cleanText}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return { translatedText: cached, sourceLanguage: source, targetLanguage: target };
    }

    try {
      const translatedParts: string[] = [];
      for (const segment of splitUtf8(cleanText)) {
        translatedParts.push(await this.translateSegment(segment, source, target));
      }
      const translatedText = translatedParts.join("");
      this.cache.set(cacheKey, translatedText);
      if (this.cache.size > CACHE_LIMIT) {
        const oldest = this.cache.keys().next().value as string | undefined;
        if (oldest) this.cache.delete(oldest);
      }
      return { translatedText, sourceLanguage: source, targetLanguage: target };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("تعذرت الترجمة الآن، حاول مرة أخرى بعد قليل");
    }
  }

  private async translateSegment(segment: string, source: Language, target: Language) {
    const leadingWhitespace = segment.match(/^\s*/)?.[0] || "";
    const trailingWhitespace = segment.match(/\s*$/)?.[0] || "";
    const content = segment.trim();
    if (!content) return segment;
    const endpoint = this.config.get<string>(
      "TRANSLATION_API_URL",
      "https://api.mymemory.translated.net/get",
    );
    const url = new URL(endpoint);
    url.searchParams.set("q", content);
    url.searchParams.set("langpair", `${source}|${target}`);
    url.searchParams.set("mt", "1");
    const email = this.config.get<string>("TRANSLATION_CONTACT_EMAIL");
    const key = this.config.get<string>("MYMEMORY_API_KEY");
    if (email) url.searchParams.set("de", email);
    if (key) url.searchParams.set("key", key);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await response.json().catch(() => ({}))) as MyMemoryResponse;
    const translated = data.responseData?.translatedText?.trim();
    if (!response.ok || !translated || (data.responseStatus && data.responseStatus >= 400)) {
      throw new ServiceUnavailableException(
        data.responseDetails || "تعذرت الترجمة الآن، حاول مرة أخرى بعد قليل",
      );
    }
    return `${leadingWhitespace}${decodeEntities(translated)}${trailingWhitespace}`;
  }
}
