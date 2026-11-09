import { useMemo, useState } from 'react';
import { Btn, Card, MessageCard, Mono, Overline, Skel, TagPill } from '../components/ui';
import { useSession } from '../wallet/session';
import type { GatewayModel } from './inferenceGatewayApi';
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
  const [inputs, setInputs] = useState('{\n  "prompt": "Hello"\n}');
  const [parseErr, setParseErr] = useState<string | null>(null);
  const effectiveSel = sel || options.find((o) => o.available)?.value || options[0]?.value || '';

  const execute = () => {
    setParseErr(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(inputs);
    } catch (e) {
      setParseErr((e as Error).message);
      return;
    }
    const [bucket, name, version] = effectiveSel.split('|');
    run.mutate({ model: { bucket: Number(bucket), name, version }, inputs: parsed, apiKey: apiKey.trim() || undefined });
  };

  const result = run.data;
  return (
    <Card style={{ marginTop: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <strong>Playground</strong>
        <TagPill>inference</TagPill>
      </div>
      <p style={{ margin: '6px 0 0', color: 'var(--b-tx2)', font: '400 13px/1.5 var(--font-sans)' }}>
        Run a model with raw JSON inputs (keyed by the model&apos;s params). Compute models need an API key.
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

        <label style={labelStyle}>
          Inputs (JSON)
          <textarea
            value={inputs}
            onChange={(e) => setInputs(e.target.value)}
            rows={5}
            style={{ ...fieldStyle, font: '400 12px/1.4 var(--font-mono)', resize: 'vertical' }}
          />
        </label>

        <ApiKeyField apiKey={apiKey} setApiKey={setApiKey} />

        <div>
          <Btn variant="primary" size="sm" onClick={execute} disabled={run.isPending || !effectiveSel}>
            {run.isPending ? 'Running…' : 'Run'}
          </Btn>
        </div>

        {parseErr && <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>Inputs are not valid JSON: {parseErr}</p>}
        {run.isError && <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>{(run.error as Error)?.message ?? 'Inference failed'}</p>}
        {result !== undefined && (
          <pre
            style={{
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
            }}
          >
            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
          </pre>
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
