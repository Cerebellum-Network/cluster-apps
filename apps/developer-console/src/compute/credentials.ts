/**
 * Where a credential an egress rule names comes from. Credentials have three
 * scopes (build design 3.2, "Credentials"): a sandbox's own (given at create,
 * dropped when it ends), an agent's (`PUT /v1/secrets/{name}?agent=`, used only
 * by that agent's runs, the sandboxes labelled `cere.agent=<agent>`), and the
 * bucket's. A name resolves narrowest first: the sandbox's own, then its
 * agent's, then the bucket's. The resource manager and the egress proxy resolve
 * it that way; the console does the same before it saves or runs, so it checks
 * the secret that will actually be used.
 */
import { LABEL } from './agentRun';
import {
  parseHosts,
  SECRET_HOST_RE,
  SECRET_NAME_RE,
  type EgressRule,
  type Sandbox,
  type SandboxSecret,
  type SandboxSecretInput,
  type SecretSummary,
} from './types';

export type CredentialScope = 'sandbox' | 'agent' | 'bucket';

/** A credential a rule can name, from one of the three scopes. Never a value. */
export interface Credential {
  name: string;
  header: string;
  /** The hosts it is sent to; absent from gateways that predate host binding. */
  hosts?: string[];
  scope: CredentialScope;
  /** The agent, for an agent's secret. */
  agent?: string;
  updated_at?: string;
  /** Wider scopes that hold a secret of the same name, which this one wins over. */
  overrides?: CredentialScope[];
}

/** The bucket's own secrets: those not of an agent. */
export const bucketSecrets = (all: SecretSummary[] | undefined): SecretSummary[] | undefined =>
  all?.filter((s) => !s.agent);

/** One agent's secrets. */
export const agentSecrets = (all: SecretSummary[] | undefined, agent: string): SecretSummary[] | undefined =>
  all?.filter((s) => s.agent === agent);

/** The agents that hold secrets, sorted. */
export const secretAgents = (all: SecretSummary[] | undefined): string[] =>
  [...new Set((all ?? []).flatMap((s) => (s.agent ? [s.agent] : [])))].sort();

/**
 * The credentials a sandbox's rules can name, in the order a name resolves:
 * its own (`own`), then its agent's (`agent`), then the bucket's; one per name,
 * the narrowest. `all` is `GET /v1/secrets` (the bucket's and its agents');
 * undefined while it is unknown.
 */
export function credentialsFor(
  all: SecretSummary[] | undefined,
  ctx: { own?: Pick<SandboxSecret, 'name' | 'header' | 'hosts'>[]; agent?: string | null } = {},
): Credential[] | undefined {
  if (!all) return undefined;
  const out = new Map<string, Credential>();
  const add = (c: Credential) => {
    const won = out.get(c.name);
    if (won) won.overrides = [...(won.overrides ?? []), c.scope];
    else out.set(c.name, c);
  };
  for (const s of ctx.own ?? []) add({ name: s.name, header: s.header, hosts: s.hosts, scope: 'sandbox' });
  if (ctx.agent)
    for (const s of all)
      if (s.agent === ctx.agent)
        add({ name: s.name, header: s.header, hosts: s.hosts, scope: 'agent', agent: s.agent, updated_at: s.updated_at });
  for (const s of all)
    if (!s.agent) add({ name: s.name, header: s.header, hosts: s.hosts, scope: 'bucket', updated_at: s.updated_at });
  return [...out.values()];
}

/** The agent a sandbox is a run of, from its label; null for a plain sandbox. */
export const agentOf = (sb: Pick<Sandbox, 'labels'>): string | null => sb.labels[LABEL.agent] || null;

/** What a running sandbox's rules can name: its own secrets, its agent's, the bucket's. */
export const credentialsOfSandbox = (
  all: SecretSummary[] | undefined,
  sb: Pick<Sandbox, 'labels' | 'secrets'>,
): Credential[] | undefined => credentialsFor(all, { own: sb.secrets, agent: agentOf(sb) });

/** Every credential name a rule uses: its `credential` (header mode) or its `placeholders`. */
export const ruleCredentials = (r: Pick<EgressRule, 'credential' | 'placeholders'>): string[] =>
  r.placeholders?.length ? [...r.placeholders] : r.credential ? [r.credential] : [];

/** Where a credential comes from, in a few words: "this sandbox", "agent sre", "the bucket". */
export function scopeLabel(c: Pick<Credential, 'scope' | 'agent'>): string {
  if (c.scope === 'sandbox') return 'this sandbox';
  if (c.scope === 'agent') return `agent ${c.agent}`;
  return 'the bucket';
}

/**
 * Whether a running sandbox uses `secret` (one of `GET /v1/secrets`): a rule
 * names it, and the name resolves to it, not to a narrower secret of the same name.
 */
export function sandboxUses(
  sb: Pick<Sandbox, 'labels' | 'secrets' | 'egress'>,
  secret: Pick<SecretSummary, 'name' | 'agent'>,
  all: SecretSummary[],
): boolean {
  if (secret.agent && agentOf(sb) !== secret.agent) return false;
  if (!sb.egress.allow.some((r) => ruleCredentials(r).includes(secret.name))) return false;
  const won = credentialsOfSandbox(all, sb)?.find((c) => c.name === secret.name);
  return !!won && won.scope === (secret.agent ? 'agent' : 'bucket');
}

/** The one line that says how a name resolves. */
export const RESOLUTION_NOTE =
  'A rule’s credential is looked up in the sandbox’s own credentials, then its agent’s, then the bucket’s: the narrowest wins.';

/** The most credentials a sandbox may be created with. */
export const MAX_SANDBOX_SECRETS = 32;
const VALUE_MAX = 8 * 1024;

/** One of a new sandbox's own credentials as its form edits it. */
export interface OwnSecretForm {
  name: string;
  header: string;
  hosts: string;
  value: string;
  /** Send the value as `Bearer <value>` (the SDK's `Secret.bearer`); only for the Authorization header. */
  bearer: boolean;
}

export const emptyOwnSecret = (): OwnSecretForm => ({
  name: '',
  header: 'Authorization',
  hosts: '',
  value: '',
  bearer: true,
});

/** The value as it is sent: `Bearer <value>` for a bearer token in Authorization. */
export const ownSecretValue = (f: Pick<OwnSecretForm, 'header' | 'value' | 'bearer'>): string =>
  f.bearer && f.header.trim().toLowerCase() === 'authorization' ? `Bearer ${f.value}` : f.value;

/**
 * The forms as the create body's `secrets`, with each one's problem (index-aligned, undefined when fine), by the
 * rules of `PUT /v1/secrets` with `hosts` required.
 */
export function ownSecretsFromForms(forms: OwnSecretForm[]): {
  secrets: SandboxSecretInput[];
  errors: (string | undefined)[];
  ok: boolean;
} {
  const secrets: SandboxSecretInput[] = forms.map((f) => ({
    name: f.name.trim(),
    type: 'header',
    header: f.header.trim(),
    value: ownSecretValue(f),
    hosts: parseHosts(f.hosts),
  }));
  const errors = secrets.map((s, i) => {
    if (!SECRET_NAME_RE.test(s.name)) return 'A name of lowercase letters, digits and dashes.';
    if (secrets.findIndex((x) => x.name === s.name) !== i) return `${s.name} is listed twice.`;
    if (!/^[A-Za-z0-9-]+$/.test(s.header)) return 'A header name, e.g. Authorization.';
    if (!s.hosts.length) return 'The hosts it may be sent to.';
    const bad = s.hosts.find((h) => !SECRET_HOST_RE.test(h));
    if (bad) return `“${bad}” is not a host name. Use names like api.github.com, not URLs.`;
    if (!forms[i].value) return 'Its value.';
    if (new TextEncoder().encode(s.value).length > VALUE_MAX) return 'At most 8 KiB.';
    return undefined;
  });
  if (forms.length > MAX_SANDBOX_SECRETS) errors[MAX_SANDBOX_SECRETS] = `At most ${MAX_SANDBOX_SECRETS} credentials.`;
  return { secrets, errors, ok: errors.every((e) => !e) };
}
