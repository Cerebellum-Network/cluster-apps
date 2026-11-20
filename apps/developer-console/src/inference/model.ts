/**
 * How a gateway model reads on the Models page: live capacity, where it runs,
 * its context window and price. Ported from ROC (src/features/models/
 * modelStatus.ts), dropping the service-specific "limited" marker and the design
 * system's StatusDot (callers map `tone` to a colour).
 */
import type { GatewayModel, GatewayModelStatus, ModelManifest } from './gateway';

export type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

export interface Capacity {
  status: GatewayModelStatus;
  tone: StatusTone;
  label: string;
  /** "3/10 in flight · 2 queued", or '' when the gateway reports no numbers. */
  detail: string;
}

const STATUSES: Record<GatewayModelStatus, { tone: StatusTone; label: string }> = {
  available: { tone: 'success', label: 'available' },
  busy: { tone: 'warning', label: 'busy' },
  saturated: { tone: 'error', label: 'at capacity' },
  unavailable: { tone: 'neutral', label: 'unavailable' },
};

/**
 * The gateway's verdict when it gives one. An older gateway has no `status`, so
 * routability is all there is to go on.
 */
export function capacityOf(m: GatewayModel): Capacity {
  const status: GatewayModelStatus =
    m.status && Object.prototype.hasOwnProperty.call(STATUSES, m.status)
      ? m.status
      : m.routableReplicas > 0
        ? 'available'
        : 'unavailable';
  const inFlight = m.inFlight ?? 0;
  const ceiling = m.ceiling ?? 0;
  const parts: string[] = [];
  if (ceiling > 0) parts.push(`${inFlight}/${ceiling} in flight`);
  else if (inFlight > 0) parts.push(`${inFlight} in flight`);
  if ((m.queueDepth ?? 0) > 0) parts.push(`${m.queueDepth} queued`);
  // "busy · 1/2" when there is a ceiling to show it against.
  const label = status === 'busy' && ceiling > 0 ? `busy · ${inFlight}/${ceiling}` : STATUSES[status].label;
  return { status, tone: STATUSES[status].tone, label, detail: parts.join(' · ') };
}

/** The Models page's one-line notice, or null when no model is full. */
export function atCapacityNotice(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is at capacity — new requests are refused with 429.`;
  return `${names.length} models are at capacity (${names.join(', ')}) — new requests are refused with 429.`;
}

export interface Hosting {
  external: boolean;
  /** "External · Z.AI" or "Self-hosted". */
  label: string;
}

const PROVIDER_NAMES: Record<string, string> = { zai: 'Z.AI', 'z.ai': 'Z.AI' };
const providerName = (raw: string): string => PROVIDER_NAMES[raw.toLowerCase()] ?? raw;

/** External when the manifest says so: a `remote` framework or `sovereign: false`. */
export function hostingOf(manifest: ModelManifest | null): Hosting {
  const external = manifest?.framework === 'remote' || manifest?.sovereign === false;
  if (!external) return { external: false, label: 'Self-hosted' };
  const provider = manifest?.remote?.pool || '';
  return { external: true, label: provider ? `External · ${providerName(provider)}` : 'External' };
}

/** 131072 → "128K", 200000 → "200K", 900 → "900". */
export function formatTokenCount(n: number): string {
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}K`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** The model's context window as a label, or null when the manifest does not say. */
export function contextWindowOf(manifest: ModelManifest | null): string | null {
  const n = manifest?.max_input_tokens;
  return typeof n === 'number' && n > 0 ? `${formatTokenCount(n)} context` : null;
}

/** A price amount, never in scientific notation (prices run to tiny fractions). */
function price(v: number): string {
  if (v === 0) return '$0';
  if (v >= 0.01) return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const d = Math.min(20, Math.ceil(-Math.log10(v)) + 2); // 3 significant figures
  return '$' + v.toFixed(d).replace(/0+$/, '');
}

/**
 * The price line from a manifest, e.g. "$0.0000025 in · $0.00001 out / token",
 * or null when the manifest carries no pricing.
 */
export function priceOf(manifest: ModelManifest | null): string | null {
  const p = manifest?.pricing;
  if (!p || (p.inputCost == null && p.outputCost == null)) return null;
  const unit = p.unit || 'unit';
  if (p.inputCost != null && p.outputCost != null) {
    return `${price(p.inputCost)} in · ${price(p.outputCost)} out / ${unit}`;
  }
  const only = p.inputCost ?? p.outputCost ?? 0;
  return `${price(only)} / ${unit}`;
}

/** Price scaled to the readable unit the Models table shows ("per 1M tokens"). */
export interface PerMillionPrice {
  /** "$0.28 / $1.40" (in / out) or "$56.00" (single). */
  amount: string;
  /** "per 1M tokens in / out" or "per 1M requests". */
  note: string;
}

const MILLION = 1_000_000;

/**
 * Per-million pricing for the Models table (mockup: "$0.28 / $1.40 — per 1M
 * tokens in / out"). Prices in the manifest are per single unit; scale by 1e6.
 * Null when the manifest carries no pricing.
 */
export function pricePerMillionOf(manifest: ModelManifest | null): PerMillionPrice | null {
  const p = manifest?.pricing;
  if (!p || (p.inputCost == null && p.outputCost == null)) return null;
  const noun = `1M ${p.unit || 'unit'}s`;
  if (p.inputCost != null && p.outputCost != null) {
    return { amount: `${price(p.inputCost * MILLION)} / ${price(p.outputCost * MILLION)}`, note: `per ${noun} in / out` };
  }
  const only = p.inputCost ?? p.outputCost ?? 0;
  return { amount: price(only * MILLION), note: `per ${noun}` };
}

/** Friendly model-type label for the table, from the manifest `task`. */
const TASK_LABELS: Record<string, string> = {
  'text-generation': 'Chat',
  'automatic-speech-recognition': 'Speech to text',
  'speaker-embedding': 'Speaker embeddings',
  'audio-segmentation': 'Who spoke when',
  'audio-classification': 'Audio classification',
  'text-classification': 'Text classification',
  'feature-extraction': 'Embeddings',
};

export function taskLabel(task: string | null): string {
  if (!task) return 'Model';
  return TASK_LABELS[task.toLowerCase()] ?? task;
}

/** The human-facing model name: the gateway alias if set, else the raw name. */
export function displayName(m: GatewayModel): string {
  return m.alias || m.name;
}

/** The combined view model a card renders. */
export interface ModelCard {
  id: string;
  name: string;
  version: string;
  task: string | null;
  capacity: Capacity;
  hosting: Hosting;
  context: string | null;
  price: string | null;
  pricePerMillion: PerMillionPrice | null;
  description: string | null;
}

/**
 * A speech-to-text (ASR) model — the `/audio/transcriptions` route. Scoped to
 * transcription on purpose: `audio-classification`, `audio-segmentation` and
 * `speaker-embedding` are audio models too but are not transcription endpoints.
 */
export function isSpeechModel(task: string | null): boolean {
  if (!task) return false;
  const t = task.toLowerCase();
  return t.includes('speech-recognition') || t.includes('transcri') || t === 'asr' || t.includes('speech-to-text');
}

/**
 * A chat / text-generation model — the `/chat/completions` + `/messages` routes.
 * Keyed to generation, not the bare word "text": `text-classification` and
 * `text-embedding` carry "text" but are not chat endpoints.
 */
export function isChatModel(task: string | null): boolean {
  if (!task) return false;
  const t = task.toLowerCase();
  return (
    t.includes('generation') ||
    t.includes('chat') ||
    t.includes('conversational') ||
    t.includes('instruct') ||
    t.includes('completion')
  );
}

export interface ExampleModels {
  /** A chat model id for the SDK/curl samples, or null when none is known. */
  chat: string | null;
  /** A speech model id for the transcription sample, or null when none is known. */
  speech: string | null;
}

/**
 * Pick concrete model ids for the Quickstart samples: prefer a model that is
 * actually serving (available/busy) over one at capacity or unknown, so the
 * copyable snippet names something a reader can call right now. Chat falls back
 * to the first card so the OpenAI/curl samples always carry a real id.
 */
export function exampleModels(cards: ModelCard[]): ExampleModels {
  const ready = (c: ModelCard) => c.capacity.status === 'available' || c.capacity.status === 'busy';
  const pick = (pred: (task: string | null) => boolean): string | null =>
    cards.find((c) => ready(c) && pred(c.task))?.name ?? cards.find((c) => pred(c.task))?.name ?? null;
  const chat = pick(isChatModel) ?? (cards.find(ready) ?? cards[0])?.name ?? null;
  return { chat, speech: pick(isSpeechModel) };
}

export function toModelCard(m: GatewayModel, manifest: ModelManifest | null): ModelCard {
  return {
    id: m.id,
    name: displayName(m),
    version: m.version,
    task: (manifest?.task as string | undefined) ?? null,
    capacity: capacityOf(m),
    hosting: hostingOf(manifest),
    context: contextWindowOf(manifest),
    price: priceOf(manifest),
    pricePerMillion: pricePerMillionOf(manifest),
    description: (manifest?.description as string | undefined) ?? null,
  };
}

/**
 * The model ids the quickstart's model picker offers: chat models, serving ones
 * first, each once. When the catalogue tags no model as chat (manifests
 * missing), every model is offered so the picker is never empty while models exist.
 */
export function chatModelChoices(cards: ModelCard[]): string[] {
  const ready = (c: ModelCard) => c.capacity.status === 'available' || c.capacity.status === 'busy';
  const chat = cards.filter((c) => isChatModel(c.task));
  const pool = chat.length > 0 ? chat : cards;
  const ordered = [...pool.filter(ready), ...pool.filter((c) => !ready(c))];
  return [...new Set(ordered.map((c) => c.name))];
}

/** Compare "v1.2.10"-style versions numerically; non-numeric parts fall back to string order. */
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.');
  const pb = b.replace(/^v/, '').split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number(pa[i] ?? 0);
    const y = Number(pb[i] ?? 0);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      const c = (pa[i] ?? '').localeCompare(pb[i] ?? '');
      if (c !== 0) return c;
    } else if (x !== y) return x - y;
  }
  return 0;
}

/**
 * One entry per model: the catalogue lists every published version of a model
 * (bucket/name/version), which read as duplicates. Keep the newest version that
 * is serving; if none is, the newest version.
 */
export function latestPerModel(models: GatewayModel[]): GatewayModel[] {
  const best = new Map<string, GatewayModel>();
  for (const m of models) {
    const key = `${m.bucket}/${m.name}`;
    const cur = best.get(key);
    if (!cur) { best.set(key, m); continue; }
    const curUp = cur.available ? 1 : 0;
    const mUp = m.available ? 1 : 0;
    if (mUp > curUp || (mUp === curUp && compareVersions(m.version, cur.version) > 0)) best.set(key, m);
  }
  return [...best.values()];
}
