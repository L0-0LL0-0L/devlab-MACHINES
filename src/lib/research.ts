export const RESEARCH_ROLES = [
  { id: "literature", name: "Literature reviewer", desc: "Maps prior work and citations." },
  { id: "methods", name: "Methods critic", desc: "Checks study design and controls." },
  { id: "statistics", name: "Statistician", desc: "Audits power, effect sizes and tests." },
  { id: "molecular", name: "Molecular biologist", desc: "Mechanisms, pathways, targets." },
  { id: "clinical", name: "Clinical researcher", desc: "Trial design and patient outcomes." },
  { id: "pharma", name: "Pharmacologist", desc: "Dosing, PK/PD and safety." },
  { id: "genomics", name: "Genomics analyst", desc: "Sequencing and variant evidence." },
  { id: "chemistry", name: "Medicinal chemist", desc: "Compounds, synthesis, SAR." },
  { id: "reproducibility", name: "Reproducibility auditor", desc: "Data, code and replication risk." },
  { id: "ethics", name: "Ethics reviewer", desc: "Consent, risk and governance." },
  { id: "regulatory", name: "Regulatory strategist", desc: "Approval pathways and compliance." },
  { id: "funding", name: "Funding analyst", desc: "Budget, milestones and treasury fit." },
] as const;

export const CATEGORIES = [
  "Longevity", "Neuroscience", "Oncology", "Rare disease", "Synthetic biology",
  "Microbiome", "Infectious disease", "Bioinformatics", "Other",
] as const;

export type Paper = { id: string; title: string; year: number | null; venue: string | null; url: string; authors: string };

// Real public paper search via OpenAlex (no key required).
export async function searchPapers(q: string): Promise<Paper[]> {
  const res = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=8`);
  if (!res.ok) throw new Error("Paper search failed");
  const json = (await res.json()) as {
    results: {
      id: string; display_name: string; publication_year: number | null; doi: string | null;
      primary_location?: { source?: { display_name?: string } | null } | null;
      authorships: { author: { display_name: string } }[];
    }[];
  };
  return json.results.map((r) => ({
    id: r.id,
    title: r.display_name,
    year: r.publication_year,
    venue: r.primary_location?.source?.display_name ?? null,
    url: r.doi ?? r.id,
    authors: r.authorships.slice(0, 3).map((a) => a.author.display_name).join(", ") + (r.authorships.length > 3 ? " et al." : ""),
  }));
}
