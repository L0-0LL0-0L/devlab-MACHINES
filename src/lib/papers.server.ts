// Server-only paper discovery. Fixed, allowlisted hosts only (no user-supplied URLs → no SSRF).
import type { Paper } from "./research";

const TIMEOUT = 8000;
const UA = "biocode-research/1.0 (mailto:research@biocode.app)";

async function get(url: string, accept = "application/json") {
  const u = new URL(url);
  if (!["api.crossref.org", "www.ebi.ac.uk", "export.arxiv.org"].includes(u.host)) throw new Error("host not allowed");
  const res = await fetch(u, { headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`${u.host} ${res.status}`);
  const text = await res.text();
  if (text.length > 2_000_000) throw new Error("response too large");
  return text;
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export async function searchCrossref(q: string, n: number): Promise<Paper[]> {
  const j = JSON.parse(await get(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${n}&select=DOI,title,author,issued,container-title,abstract,URL`)) as {
    message: { items: { DOI: string; title?: string[]; author?: { given?: string; family?: string }[]; issued?: { "date-parts"?: number[][] }; "container-title"?: string[]; abstract?: string; URL?: string }[] };
  };
  return j.message.items.filter((i) => i.title?.[0]).map((i) => ({
    provider: "crossref" as const,
    external_id: `doi:${i.DOI}`,
    title: stripTags(i.title![0]),
    authors: fmtAuthors((i.author ?? []).map((a) => [a.given, a.family].filter(Boolean).join(" "))),
    year: i.issued?.["date-parts"]?.[0]?.[0] ?? null,
    venue: i["container-title"]?.[0] ?? null,
    url: `https://doi.org/${i.DOI}`,
    abstract: i.abstract ? stripTags(i.abstract).slice(0, 20000) : null,
  }));
}

export async function searchEuropePmc(q: string, n: number): Promise<Paper[]> {
  const j = JSON.parse(await get(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&resultType=core&pageSize=${n}`)) as {
    resultList: { result: { id: string; source: string; pmid?: string; doi?: string; title: string; authorString?: string; pubYear?: string; journalTitle?: string; abstractText?: string }[] };
  };
  return j.resultList.result.map((r) => ({
    provider: "europepmc" as const,
    external_id: r.pmid ? `pmid:${r.pmid}` : r.doi ? `doi:${r.doi}` : `${r.source}:${r.id}`,
    title: stripTags(r.title),
    authors: r.authorString ? fmtAuthors(r.authorString.split(", ")) : "",
    year: r.pubYear ? Number(r.pubYear) : null,
    venue: r.journalTitle ?? null,
    url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`,
    abstract: r.abstractText ? stripTags(r.abstractText).slice(0, 20000) : null,
  }));
}

export async function searchArxiv(q: string, n: number): Promise<Paper[]> {
  const xml = await get(`https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=${n}`, "application/atom+xml");
  const entries = xml.split("<entry>").slice(1);
  return entries.map((e) => {
    const tag = (t: string) => stripTags(e.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "");
    const id = tag("id");
    const authors = [...e.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => stripTags(m[1]));
    const absId = id.replace(/^https?:\/\/arxiv\.org\/abs\//, "");
    return {
      provider: "arxiv" as const,
      external_id: `arxiv:${absId}`,
      title: tag("title"),
      authors: fmtAuthors(authors),
      year: Number(tag("published").slice(0, 4)) || null,
      venue: "arXiv",
      url: `https://arxiv.org/abs/${absId}`,
      abstract: tag("summary").slice(0, 20000) || null,
    };
  }).filter((p) => p.title);
}

function fmtAuthors(a: string[]) {
  return a.slice(0, 3).join(", ") + (a.length > 3 ? " et al." : "");
}
