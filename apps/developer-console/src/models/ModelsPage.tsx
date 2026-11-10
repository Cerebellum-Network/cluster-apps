import { useMemo, useState } from 'react';
import { Btn, Card, MessageCard, Mono, Overline, Skel, TagPill } from '../components/ui';
import { useSession } from '../wallet/session';
import { runInferenceStream, type GatewayModel, type SchemaProperty } from './inferenceGatewayApi';
import { useLimits, useMintApiKey, useModelCatalog, useModelManifest, useRunInference } from './queries';

const TTL_OPTIONS: { label: string; ms: number }[] = [
  { label: '1 hour', ms: 3_600_000 },
  { label: '1 day', ms: 86_400_000 },
  { label: '7 days', ms: 604_800_000 },
];

/**
 * Developer Console -- Models (Phase 1 slice).
 *
 * The inference gateway's model catalog (`GET /api/v1/models`). One card per
 * model NAME; the gateway lists a row per version. Public GET, no wallet.
 * Playground / API keys / usage come next (see the Developer Console brief).
 */
interface ModelGroup {
  name: string;
  versions: GatewayModel[];
  anyAvailable: boolean;
  replicas: number;
}

function group(models: GatewayModel[]): ModelGroup[] {
  const byName = new Map<string, GatewayModel[]>();
  for (const m of models) {
    const list = byName.get(m.name) ?? [];
    list.push(m);
    byName.set(m.name, list);
  }
  return [...byName.entries()]
    .map(([name, versions]) => ({
      name,
      versions: versions.slice().sort((a, b) => b.version.localeCompare(a.version)),
      anyAvailable: versions.some((v) => v.available),
      replicas: versions.reduce((n, v) => n + v.routableReplicas, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function statusColor(available: boolean): string {
  return available ? 'var(--b-ok-tx)' : 'var(--b-tx3)';
}

export function ModelsPage() {
  const catalog = useModelCatalog();
  const [q, setQ] = useState('');
  // Shared across the key/playground/usage cards: minting prefills it, and the
  // playground + usage read from the same field.
  const [apiKey, setApiKey] = useState('');

  const groups = useMemo(() => group(catalog.data?.models ?? []), [catalog.data]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? groups.filter((g) => g.name.toLowerCase().includes(needle)) : groups;
  }, [groups, q]);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Overline>Models</Overline>
        {catalog.data && (
          <Mono style={{ fontSize: 12, color: 'var(--b-tx2)' }}>{groups.length} models</Mono>
        )}
      </div>

      <ApiKeyCard onKey={setApiKey} />
      <PlaygroundCard models={catalog.data?.models ?? []} apiKey={apiKey} setApiKey={setApiKey} />
      <UsageCard apiKey={apiKey} setApiKey={setApiKey} />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search models"
        style={{
          marginTop: 12,
          width: '100%',
          maxWidth: 360,
          padding: '8px 10px',
          border: '1px solid var(--b-line)',
          borderRadius: 8,
          font: '400 14px/1 var(--font-sans)',
        }}
      />

      {catalog.isLoading && (
        <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
          <Skel w="100%" h={64} />
          <Skel w="100%" h={64} />
          <Skel w="100%" h={64} />
        </div>
      )}

      {catalog.isError && (
        <div style={{ marginTop: 16 }}>
          <MessageCard
            glyph="!"
            iconBg="var(--b-err-bg)"
            iconTx="var(--b-err-tx)"
            title="Could not load the model catalog."
            body="The inference gateway did not respond."
            cta="Retry"
            onCta={() => void catalog.refetch()}
          />
        </div>
      )}

      {catalog.data && filtered.length === 0 && (
        <p style={{ marginTop: 16, color: 'var(--b-tx2)' }}>No models match “{q}”.</p>
      )}

      {filtered.length > 0 && (
        <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
          {filtered.map((g) => (
            <ModelCard key={g.name} group={g} />
          ))}
        </div>
      )}
    </>
  );
}

function ApiKeyCard({ onKey }: { onKey: (key: string) => void }) {
  const s = useSession();
  const mint = useMintApiKey(s.getSigner);
  const [bucket, setBucket] = useState('');
  const [ttlMs, setTtlMs] = useState(TTL_OPTIONS[1].ms);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const bucketOk = /^\d+$/.test(bucket.trim());
  const ttlLabel = TTL_OPTIONS.find((t) => t.ms === ttlMs)?.label ?? '';

  const generate = () => {
    setApiKey(null);
    setCopied(false);
    mint.mutate(
      { bucketId: BigInt(bucket.trim()), ttlMs },
      {
        onSuccess: (key) => {
          setApiKey(key);
          onKey(key); // prefill the playground + usage fields
        },
      },
    );
  };

  return (
    <Card style={{ marginTop: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <strong>Inference API key</strong>
        <TagPill>bearer · not revocable</TagPill>
      </div>
      <p style={{ margin: '6px 0 0', color: 'var(--b-tx2)', font: '400 13px/1.5 var(--font-sans)' }}>
        A key scoped to one bucket (the numeric chain id usage bills to), for OpenAI/Anthropic-style
        clients. It is shown once, can&apos;t be revoked, and only expires.
      </p>

      <div style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 520 }}>
        <label style={{ display: 'grid', gap: 4, font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
          Bucket id (numeric)
          <input
            value={bucket}
            onChange={(e) => setBucket(e.target.value)}
            placeholder="e.g. 576130"
            style={{ padding: '8px 10px', border: '1px solid var(--b-line)', borderRadius: 8, font: '400 14px/1 var(--font-mono)' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4, font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
          Expires in
          <select
            value={ttlMs}
            onChange={(e) => setTtlMs(Number(e.target.value))}
            style={{ padding: '8px 10px', border: '1px solid var(--b-line)', borderRadius: 8, font: '400 14px/1 var(--font-sans)' }}
          >
            {TTL_OPTIONS.map((t) => (
              <option key={t.ms} value={t.ms}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <Btn variant="primary" size="sm" onClick={generate} disabled={mint.isPending || !bucketOk}>
            {mint.isPending ? 'Generating…' : 'Generate key'}
          </Btn>
        </div>

        {mint.isError && (
          <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>
            Generate failed: {(mint.error as Error)?.message ?? 'unknown'}
          </p>
        )}

        {apiKey && (
          <div style={{ display: 'grid', gap: 6 }}>
            <p style={{ margin: 0, color: 'var(--b-ok-tx)' }}>
              Key created, valid {ttlLabel}. Copy it now — it won&apos;t be shown again.
            </p>
            <textarea
              readOnly
              value={apiKey}
              rows={3}
              onFocus={(e) => e.currentTarget.select()}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid var(--b-line)',
                borderRadius: 8,
                font: '400 12px/1.4 var(--font-mono)',
                resize: 'vertical',
                wordBreak: 'break-all',
              }}
            />
            <div>
              <Btn
                variant="outline"
                size="xs"
                onClick={() => {
                  void navigator.clipboard?.writeText(apiKey).then(() => setCopied(true));
                }}
              >
                {copied ? 'Copied' : 'Copy key'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const fieldStyle = {
  padding: '8px 10px',
  border: '1px solid var(--b-line)',
  borderRadius: 8,
} as const;
const labelStyle = { display: 'grid', gap: 4, font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' } as const;

function ApiKeyField({ apiKey, setApiKey }: { apiKey: string; setApiKey: (k: string) => void }) {
  return (
    <label style={labelStyle}>
      API key
      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Paste an inference API key (or generate one above)"
        style={{ ...fieldStyle, font: '400 12px/1 var(--font-mono)' }}
      />
    </label>
  );
}

/** Coerce a form field's raw string to the type its schema declares. */
function coerceField(raw: string, type?: string): unknown {
  const t = (type ?? 'string').toLowerCase();
  if (t === 'number' || t === 'integer') {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error('not a number');
    return t === 'integer' ? Math.trunc(n) : n;
  }
  if (t === 'boolean') return raw === 'true' || raw === '1';
  if (t === 'array' || t === 'object') return JSON.parse(raw);
  return raw;
}

const resultPreStyle = {
  margin: 0,
  padding: '10px 12px',
  background: 'var(--b-card)',
  border: '1px solid var(--b-line)',
  borderRadius: 8,
  font: '400 12px/1.4 var(--font-mono)',
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  maxHeight: 280,
  overflow: 'auto',
} as const;

/** One schema-driven input field (enum → select, boolean → select, else text/area). */
function SchemaField({
  name,
  prop,
  required,
  value,
  onChange,
}: {
  name: string;
  prop: SchemaProperty;
  required: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  const type = (prop.type ?? 'string').toLowerCase();
  const label = (
    <>
      {name}
      {required && <span style={{ color: 'var(--b-err-tx)' }}> *</span>}
      <span style={{ color: 'var(--b-tx3)', fontWeight: 400 }}> · {prop.type ?? 'string'}</span>
    </>
  );
  let control;
  if (prop.enum && prop.enum.length > 0) {
    control = (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, font: '400 13px/1 var(--font-sans)' }}>
        <option value="">—</option>
        {prop.enum.map((o) => (
          <option key={String(o)} value={String(o)}>
            {String(o)}
          </option>
        ))}
      </select>
    );
  } else if (type === 'boolean') {
    control = (
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...fieldStyle, font: '400 13px/1 var(--font-sans)' }}>
        <option value="">—</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  } else if (type === 'number' || type === 'integer') {
    control = (
      <input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" style={{ ...fieldStyle, font: '400 13px/1 var(--font-mono)' }} />
    );
  } else {
    control = (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} style={{ ...fieldStyle, font: '400 12px/1.4 var(--font-mono)', resize: 'vertical' }} />
    );
  }
  return (
    <label style={labelStyle} title={prop.description}>
      {label}
      {control}
    </label>
  );
}

function PlaygroundCard({
  models,
  apiKey,
  setApiKey,
}: {
  models: GatewayModel[];
  apiKey: string;
  setApiKey: (k: string) => void;
}) {
  const run = useRunInference();
  const options = useMemo(
    () => models.map((m) => ({ value: `${m.bucket}|${m.name}|${m.version}`, label: `${m.name} ${m.version}`, available: m.available })),
    [models],
  );
  const [sel, setSel] = useState('');
  const effectiveSel = sel || options.find((o) => o.available)?.value || options[0]?.value || '';
  const [selBucket, selName, selVersion] = effectiveSel ? effectiveSel.split('|') : ['', '', ''];

  // The selected model's manifest drives the form fields and whether streaming is
  // offered. Shares its query cache with the catalog cards (same bucket/name/version).
  const manifest = useModelManifest(Number(selBucket), selName, selVersion, !!effectiveSel);
  const inputSchema = manifest.data?.schema?.inputs;
  const propEntries = useMemo(() => Object.entries(inputSchema?.properties ?? {}), [inputSchema]);
  const required = inputSchema?.required ?? [];
  const hasSchema = propEntries.length > 0;
  const canStream = manifest.data?.stream === true;

  // `null` = follow the model's own default (form when it has a schema; stream when
  // it supports it); a non-null value is the user's explicit override.
  const [userMode, setUserMode] = useState<'form' | 'json' | null>(null);
  const mode: 'form' | 'json' = userMode ?? (hasSchema ? 'form' : 'json');
  const [userStream, setUserStream] = useState<boolean | null>(null);
  const streamOn = canStream && (userStream ?? true);

  const [jsonInputs, setJsonInputs] = useState('{\n  "prompt": "Hello"\n}');
  const [form, setForm] = useState<Record<string, string>>({});
  const [parseErr, setParseErr] = useState<string | null>(null);

  const [streamOut, setStreamOut] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamErr, setStreamErr] = useState<string | null>(null);

  const buildInput = (): unknown => {
    if (mode === 'json') return JSON.parse(jsonInputs);
    const out: Record<string, unknown> = {};
    for (const [k, prop] of propEntries) {
      const raw = form[k] ?? '';
      if (raw === '' && !required.includes(k)) continue;
      try {
        out[k] = coerceField(raw, prop.type);
      } catch {
        throw new Error(`Field "${k}" is not a valid ${prop.type ?? 'value'}.`);
      }
    }
    return out;
  };

  const execute = async () => {
    setParseErr(null);
    setStreamErr(null);
    let input: unknown;
    try {
      input = buildInput();
    } catch (e) {
      setParseErr((e as Error).message);
      return;
    }
    const model = { bucket: Number(selBucket), name: selName, version: selVersion };
    const key = apiKey.trim() || undefined;
    if (streamOn) {
      setStreamOut('');
      setStreaming(true);
      try {
        await runInferenceStream(
          model,
          input,
          (chunk) => setStreamOut((prev) => (prev ?? '') + (typeof chunk === 'string' ? chunk : JSON.stringify(chunk))),
          key,
        );
      } catch (e) {
        setStreamErr((e as Error).message);
      } finally {
        setStreaming(false);
      }
    } else {
      setStreamOut(null);
      run.mutate({ model, inputs: input, apiKey: key });
    }
  };

  const busy = run.isPending || streaming;
  const showStream = streamOut !== null;
  const result = run.data;
  return (
    <Card style={{ marginTop: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <strong>Playground</strong>
        <TagPill>inference</TagPill>
      </div>
      <p style={{ margin: '6px 0 0', color: 'var(--b-tx2)', font: '400 13px/1.5 var(--font-sans)' }}>
        Run a model from its declared inputs (or raw JSON). Compute models need an API key.
      </p>

      <div style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 560 }}>
        <label style={labelStyle}>
          Model
          <select value={effectiveSel} onChange={(e) => setSel(e.target.value)} style={{ ...fieldStyle, font: '400 13px/1 var(--font-mono)' }}>
            {options.length === 0 && <option value="">No models</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
                {o.available ? '' : ' (offline)'}
              </option>
            ))}
          </select>
        </label>

        {/* Inputs: form (from the manifest schema) or raw JSON. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>Inputs</span>
          {hasSchema && (
            <div style={{ display: 'inline-flex', gap: 6 }}>
              <Btn variant={mode === 'form' ? 'secondary' : 'outline'} size="xs" onClick={() => setUserMode('form')}>
                Form
              </Btn>
              <Btn variant={mode === 'json' ? 'secondary' : 'outline'} size="xs" onClick={() => setUserMode('json')}>
                JSON
              </Btn>
            </div>
          )}
        </div>

        {mode === 'form' ? (
          propEntries.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--b-tx2)', font: '400 12px/1.4 var(--font-sans)' }}>
              {manifest.isLoading ? 'Loading the model’s input schema…' : 'No input schema published — switch to JSON.'}
            </p>
          ) : (
            propEntries.map(([k, prop]) => (
              <SchemaField
                key={k}
                name={k}
                prop={prop}
                required={required.includes(k)}
                value={form[k] ?? (prop.default !== undefined ? String(prop.default) : '')}
                onChange={(v) => setForm((f) => ({ ...f, [k]: v }))}
              />
            ))
          )
        ) : (
          <textarea
            value={jsonInputs}
            onChange={(e) => setJsonInputs(e.target.value)}
            rows={5}
            style={{ ...fieldStyle, font: '400 12px/1.4 var(--font-mono)', resize: 'vertical' }}
          />
        )}

        <ApiKeyField apiKey={apiKey} setApiKey={setApiKey} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Btn variant="primary" size="sm" onClick={execute} disabled={busy || !effectiveSel}>
            {busy ? (streaming ? 'Streaming…' : 'Running…') : 'Run'}
          </Btn>
          {canStream && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: '400 13px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
              <input type="checkbox" checked={streamOn} onChange={(e) => setUserStream(e.target.checked)} />
              Stream response
            </label>
          )}
        </div>

        {parseErr && <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>{mode === 'json' ? `Inputs are not valid JSON: ${parseErr}` : parseErr}</p>}
        {streamErr && <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>{streamErr}</p>}
        {run.isError && !showStream && <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>{(run.error as Error)?.message ?? 'Inference failed'}</p>}

        {showStream ? (
          <pre style={resultPreStyle}>
            {streamOut}
            {streaming && <span style={{ color: 'var(--b-tx3)' }}>▋</span>}
          </pre>
        ) : (
          result !== undefined && (
            <pre style={resultPreStyle}>{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}</pre>
          )
        )}
      </div>
    </Card>
  );
}

function UsageCard({ apiKey, setApiKey }: { apiKey: string; setApiKey: (k: string) => void }) {
  const limits = useLimits(apiKey.trim());
  const d = limits.data;
  return (
    <Card style={{ marginTop: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <strong>Usage &amp; limits</strong>
        <TagPill>per bucket</TagPill>
      </div>
      <div style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 560 }}>
        <ApiKeyField apiKey={apiKey} setApiKey={setApiKey} />
        {!apiKey.trim() && <p style={{ margin: 0, color: 'var(--b-tx2)' }}>Enter an API key to see its bucket&apos;s usage.</p>}
        {limits.isLoading && <p style={{ margin: 0, color: 'var(--b-tx2)' }}>Loading usage…</p>}
        {limits.isError && (
          <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>{(limits.error as Error)?.message ?? 'Could not load limits'}</p>
        )}
        {d && (
          <div style={{ display: 'grid', gap: 8, font: '400 13px/1.4 var(--font-sans)' }}>
            <div style={{ color: 'var(--b-tx2)' }}>
              Bucket <Mono>{d.bucket}</Mono> · profile <Mono>{d.profile || '—'}</Mono> ·{' '}
              {d.enabled ? 'limits enforced' : 'limits not enforced'}
            </div>
            {d.models.length === 0 && <div style={{ color: 'var(--b-tx2)' }}>No per-model usage yet.</div>}
            {d.models.map((m) => (
              <div
                key={m.model}
                style={{ padding: '8px 10px', border: '1px solid var(--b-line)', borderRadius: 8, display: 'grid', gap: 2 }}
              >
                <Mono style={{ fontSize: 12, wordBreak: 'break-all' }}>{m.model}</Mono>
                <div style={{ color: 'var(--b-tx2)', fontSize: 12 }}>
                  in-flight {m.inFlight}/{m.limit.maxInFlight} · queued {m.queued} · tokens/min {m.tokensLastMinute}
                  {m.limit.tokensPerMinute ? `/${m.limit.tokensPerMinute}` : ''} · {m.modelStatus.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function ModelCard({ group: g }: { group: ModelGroup }) {
  const [open, setOpen] = useState(false);
  const primary = g.versions[0];
  const manifest = useModelManifest(primary.bucket, primary.name, primary.version, open);
  const m = manifest.data;

  return (
    <Card style={{ padding: 18 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          width: '100%',
        }}
      >
        <strong style={{ wordBreak: 'break-all' }}>{g.name}</strong>
        <TagPill accent={g.anyAvailable}>{g.anyAvailable ? 'available' : 'offline'}</TagPill>
      </button>

      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {g.versions.map((v) => (
          <span
            key={v.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 8px',
              border: '1px solid var(--b-line)',
              borderRadius: 8,
              font: '400 12px/1 var(--font-mono)',
              color: statusColor(v.available),
            }}
            title={`${v.routableReplicas} routable replica(s)${v.status ? ` · ${v.status}` : ''}`}
          >
            <Mono>{v.version}</Mono>
            <span style={{ color: 'var(--b-tx3)' }}>· {v.routableReplicas}r</span>
          </span>
        ))}
      </div>

      {open && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--b-line)', paddingTop: 12, font: '400 13px/1.5 var(--font-sans)', color: 'var(--b-tx2)' }}>
          {manifest.isLoading && 'Loading details…'}
          {!manifest.isLoading && !m && 'No manifest published for this model.'}
          {m && (
            <div style={{ display: 'grid', gap: 4 }}>
              {m.description && <div style={{ color: 'var(--b-tx)' }}>{m.description}</div>}
              <Detail label="Task" value={m.task} />
              <Detail label="Framework" value={m.framework} />
              <Detail label="Streaming" value={m.stream === undefined ? undefined : m.stream ? 'yes' : 'no'} />
              <Detail label="Context" value={m.max_input_tokens ? `${m.max_input_tokens} in / ${m.max_output_tokens ?? '?'} out tokens` : undefined} />
              {m.pricing && (
                <Detail
                  label="Pricing"
                  value={`${m.pricing.inputCost ?? '?'} in / ${m.pricing.outputCost ?? '?'} out per ${m.pricing.unit ?? 'unit'}`}
                />
              )}
              <Detail label="Bucket" value={String(primary.bucket)} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ color: 'var(--b-tx3)', minWidth: 90 }}>{label}</span>
      <span style={{ color: 'var(--b-tx)' }}>{value}</span>
    </div>
  );
}
