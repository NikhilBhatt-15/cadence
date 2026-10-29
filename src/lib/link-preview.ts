import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type LinkContext = { url: string; title: string | null; description: string | null; text: string };

const MAX_BYTES = 1_000_000;

function isPrivateAddress(ip: string) {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v.startsWith("::ffff:")) return isPrivateAddress(v.slice(7));
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Rejects non-http(s) URLs and anything resolving to a private/internal address (SSRF guard). */
export async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links work.");
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new Error(`Couldn't resolve ${url.hostname}.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new Error("Private or local addresses aren't allowed.");
  return url;
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function meta(html: string, name: string) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
    "i",
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1] ?? m[2]).trim() || null : null;
}

export async function fetchLinkContext(raw: string): Promise<LinkContext> {
  let url = await assertPublicUrl(raw.trim());

  // Follow redirects manually so every hop goes through the SSRF check.
  let res: Response | undefined;
  for (let hop = 0; hop < 4; hop++) {
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "CadenceBot/1.0 (+link preview)", Accept: "text/html,text/plain;q=0.9" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      url = await assertPublicUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!res || !res.ok) throw new Error(`The page answered with ${res?.status ?? "no response"}.`);

  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("html") && !type.includes("text/plain")) throw new Error("That link isn't a web page.");

  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const html = new TextDecoder().decode(Buffer.concat(chunks));

  const title = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
  const description = meta(html, "og:description") ?? meta(html, "description");
  const body = (html.match(/<(article|main)[\s\S]*?<\/\1>/i)?.[0] ?? html)
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body).replace(/\s+/g, " ").trim().slice(0, 8000);

  return { url: url.toString(), title: title && decodeEntities(title), description, text };
}
