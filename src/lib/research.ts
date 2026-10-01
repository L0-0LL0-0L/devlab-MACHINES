// Client-safe research definitions. The 12 generative specialist roles.
export const RESEARCH_ROLES = [
  { id: "literature_mapper", name: "Literature mapper", desc: "Maps what the supplied sources establish and where they disagree.", focus: "Map the evidence landscape across the sources: what is established, contested, or missing. Group sources by claim." },
  { id: "hypothesis_builder", name: "Hypothesis builder", desc: "Proposes testable hypotheses grounded in the sources.", focus: "Propose specific, falsifiable hypotheses that follow from the evidence. State what result would refute each." },
  { id: "methods_critic", name: "Methods critic", desc: "Audits study design, controls and confounders.", focus: "Critique study designs, controls, blinding, model systems and confounders visible in the sources." },
  { id: "statistics_reviewer", name: "Statistics reviewer", desc: "Checks power, effect sizes and analysis choices.", focus: "Assess sample sizes, effect sizes, multiple comparisons and statistical reporting visible in the sources. Do not invent numbers." },
  { id: "reproducibility_reviewer", name: "Reproducibility reviewer", desc: "Data/code availability and replication risk.", focus: "Assess data and code availability, protocol detail, replication status and reproducibility risks." },
  { id: "data_interpreter", name: "Data interpreter", desc: "Reads reported results carefully and literally.", focus: "Interpret the reported results literally: what the data show versus what authors conclude." },
  { id: "novelty_scout", name: "Novelty scout", desc: "Finds gaps and genuinely open questions.", focus: "Identify gaps, unexplored angles and genuinely open questions that the sources leave unanswered." },
  { id: "translational_researcher", name: "Translational researcher", desc: "Path from findings toward application.", focus: "Assess how far the findings are from human application and what translational steps are needed." },
  { id: "ethics_reviewer", name: "Ethics reviewer", desc: "Consent, risk, dual use and governance.", focus: "Identify ethical, safety, consent, dual-use and governance considerations." },
  { id: "funding_planner", name: "Funding planner", desc: "Milestones and what funding would test.", focus: "Outline an evidence-driven sequence of fundable milestones and what each would resolve. No dollar figures unless sourced." },
  { id: "peer_review_challenger", name: "Peer-review challenger", desc: "Argues against the emerging consensus.", focus: "Act as a skeptical peer reviewer: challenge the strongest claims and record dissent with reasons." },
  { id: "synthesis_editor", name: "Synthesis editor", desc: "Integrates all role outputs into a final view.", focus: "Integrate prior role outputs into a balanced synthesis that preserves dissent and uncertainty." },
] as const;

export type RoleId = (typeof RESEARCH_ROLES)[number]["id"];
export const ROLE_IDS = RESEARCH_ROLES.map((r) => r.id) as RoleId[];
export const roleName = (id: string) => RESEARCH_ROLES.find((r) => r.id === id)?.name ?? id;

export const CATEGORIES = [
  "Longevity", "Neuroscience", "Oncology", "Rare disease", "Synthetic biology",
  "Microbiome", "Infectious disease", "Bioinformatics", "Other",
] as const;

export const DOMAINS: Record<string, string> = {
  longevity: "Aging, lifespan, healthspan",
  neuroscience: "Brain, nervous system, cognition",
  oncology: "Cancer biology and treatment",
  rare_disease: "Rare or orphan diseases",
  synthetic_biology: "Engineered organisms, gene circuits",
  microbiome: "Microbial communities in hosts or environments",
  infectious_disease: "Pathogens, vaccines, infection",
  bioinformatics: "Computational biology, genomics data",
  other: "Other science",
};

export type Paper = {
  provider: "crossref" | "europepmc" | "arxiv";
  external_id: string;
  title: string;
  authors: string;
  year: number | null;
  venue: string | null;
  url: string;
  abstract: string | null;
};
