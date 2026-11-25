/**
 * A sandbox's egress allow-list as the egress proxy reads it (ddc-node
 * `cluster/egress-proxy/policy`: `HostMatches`, `PathUnder`, `Match`), and the
 * edits the console makes to it: allow a request the proxy denied, remove a
 * rule. The same rules apply to an agent definition's `egress.allow`, which
 * becomes each run's allow-list.
 */
import type { EgressEntry, EgressRule, HttpMethod } from './types';

const norm = (h: string) => h.trim().toLowerCase().replace(/\.$/, '');

/** A rule's host pattern against a request host: exact, or `*.suffix` for any name under suffix (not suffix itself). */
export function ruleHostMatches(pattern: string, host: string): boolean {
  const p = norm(pattern);
  const h = norm(host);
  if (!h) return false;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1);
    return h.length > suffix.length && h.endsWith(suffix);
  }
  return p === h;
}

/** A path within a rule's `path_prefix`, on segment boundaries; a prefix ending in `/` admits whatever starts with it. */
export function pathUnder(path: string, prefix: string | undefined): boolean {
  if (!prefix || prefix === '/') return true;
  if (prefix.endsWith('/')) return path.startsWith(prefix);
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Methods the proxy never forwards, whatever a rule says. */
export const NEVER_FORWARDED = ['TRACE', 'TRACK', 'CONNECT'];

/** The first rule allowing `method` on `host` under `path`, or null: what the proxy decides per request. */
export function matchRule(rules: EgressRule[], host: string, method: string, path: string): EgressRule | null {
  const m = method.toUpperCase();
  if (NEVER_FORWARDED.includes(m)) return null;
  for (const r of rules) {
    if (!ruleHostMatches(r.host, host) || !pathUnder(path, r.path_prefix)) continue;
    if (r.methods.some((x) => (x as string) === '*' || x.toUpperCase() === m)) return r;
  }
  return null;
}

/** Whether some rule names the host: what decides a CONNECT. */
export const hostAllowed = (rules: EgressRule[], host: string): boolean =>
  rules.some((r) => ruleHostMatches(r.host, host));

/**
 * Whether the current rules would let a logged request through now. A CONNECT
 * refusal carries no method or path, so a rule for its host is enough.
 */
export function allowedNow(rules: EgressRule[], e: Pick<EgressEntry, 'host' | 'method' | 'path'>): boolean {
  if (e.method.toUpperCase() === 'CONNECT' && e.path == null) return hostAllowed(rules, e.host);
  return !!matchRule(rules, e.host, e.method, e.path ?? '/');
}

const sameRule = (a: EgressRule, b: EgressRule) =>
  norm(a.host) === norm(b.host) &&
  (a.path_prefix ?? '') === (b.path_prefix ?? '') &&
  (a.credential ?? '') === (b.credential ?? '') &&
  (a.placeholders ?? []).join(',') === (b.placeholders ?? []).join(',');

/**
 * The rules with `add` allowed too. A rule for the same host, path prefix and
 * credential gains the new methods; anything else is a rule of its own, put
 * first so it decides ahead of an older rule for the same host (the proxy uses
 * the first rule that matches, and its credential).
 */
export function allowRule(rules: EgressRule[], add: EgressRule): EgressRule[] {
  const rule: EgressRule = {
    host: norm(add.host),
    methods: [...new Set(add.methods.map((m) => m.toUpperCase() as HttpMethod))],
    ...(add.path_prefix ? { path_prefix: add.path_prefix } : {}),
    ...(add.credential ? { credential: add.credential } : {}),
    ...(add.placeholders?.length ? { placeholders: [...add.placeholders] } : {}),
  };
  const i = rules.findIndex((r) => sameRule(r, rule));
  if (i < 0) return [rule, ...rules];
  const merged = [...new Set([...rules[i].methods, ...rule.methods])] as HttpMethod[];
  return rules.map((r, j) => (j === i ? { ...r, methods: merged } : r));
}

/** The method a denied entry asked for, as a rule would name it: a bare CONNECT refusal says nothing, so GET. */
export const requestedMethod = (e: Pick<EgressEntry, 'method' | 'path'>): HttpMethod =>
  (e.method.toUpperCase() === 'CONNECT' && e.path == null ? 'GET' : e.method.toUpperCase()) as HttpMethod;

export interface Denial {
  host: string;
  /** The methods the denied requests used (a bare CONNECT counts as GET). */
  methods: HttpMethod[];
  count: number;
  last: string;
  sandboxId: string | null;
  /** The newest denied entry, for the reason. */
  entry: EgressEntry;
}

/**
 * Denied requests grouped by sandbox and host, newest first, leaving out what
 * `rulesFor(sandboxId)` would allow now (a host allowed since). Entries denied
 * for another reason than the rules (a run token, a credential, an upgrade) are
 * kept: they say why.
 */
export function denials(
  entries: EgressEntry[],
  rulesFor?: (sandboxId: string | null) => EgressRule[] | null,
): Denial[] {
  const out = new Map<string, Denial>();
  for (const e of entries) {
    if (e.decision !== 'denied') continue;
    const rules = rulesFor?.(e.sandbox_id) ?? null;
    if (rules && allowedNow(rules, e)) continue;
    const key = `${e.sandbox_id ?? ''} ${norm(e.host)}`;
    const m = requestedMethod(e);
    const d = out.get(key);
    if (!d) {
      out.set(key, { host: norm(e.host), methods: [m], count: 1, last: e.ts, sandboxId: e.sandbox_id, entry: e });
      continue;
    }
    d.count += 1;
    if (!d.methods.includes(m)) d.methods.push(m);
    if (Date.parse(e.ts) > Date.parse(d.last)) {
      d.last = e.ts;
      d.entry = e;
    }
  }
  return [...out.values()].sort((a, b) => Date.parse(b.last) - Date.parse(a.last));
}

/** A rule host: an exact DNS name or `*.suffix` (lower case, at least two labels). */
export const RULE_HOST_RE = /^(\*\.)?[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** The most credentials one rule may let the sandbox name per request. */
export const MAX_PLACEHOLDERS = 16;

/** Why a rule would be refused by the gateway, in words; null when it is fine. */
export function ruleProblem(
  r: Pick<EgressRule, 'host' | 'methods' | 'path_prefix'> & Partial<Pick<EgressRule, 'credential' | 'placeholders'>>,
): string | null {
  const host = norm(r.host);
  if (!host) return 'Name a host.';
  if (/^[a-z]+:\/\//.test(host) || host.includes('/'))
    return `“${r.host}” is not a host name: use api.example.com, not a URL.`;
  if (!RULE_HOST_RE.test(host)) return `“${r.host}” is not a host name.`;
  if (!r.methods.length) return 'Pick at least one method.';
  if (r.methods.some((m) => NEVER_FORWARDED.includes(m.toUpperCase())))
    return 'TRACE, TRACK and CONNECT are never forwarded.';
  if (r.path_prefix && !r.path_prefix.startsWith('/')) return 'A path prefix starts with “/”.';
  if (r.placeholders) {
    if (r.credential) return 'A rule names one credential, or lets the sandbox pick per request: not both.';
    if (r.placeholders.length > MAX_PLACEHOLDERS) return `At most ${MAX_PLACEHOLDERS} credentials per rule.`;
  }
  return null;
}

/** The methods a rule form offers, in the order a rule lists them; `*` is any method. */
export const RULE_METHODS: HttpMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];
export const ANY_METHOD = '*' as HttpMethod;

/**
 * One rule as a form edits it: strings, an empty one meaning "not set".
 * `placeholders` null: the rule names one `credential` or none (header mode);
 * a list: the sandbox picks one of these per request (placeholder mode).
 */
export interface RuleForm {
  host: string;
  methods: HttpMethod[];
  path: string;
  credential: string;
  placeholders?: string[] | null;
}

export const emptyRule = (host = '', methods: HttpMethod[] = ['GET']): RuleForm => ({
  host,
  methods,
  path: '',
  credential: '',
  placeholders: null,
});

export const formFromRule = (r: EgressRule): RuleForm => ({
  host: r.host,
  methods: [...r.methods],
  path: r.path_prefix ?? '',
  credential: r.credential ?? '',
  placeholders: r.placeholders?.length ? [...r.placeholders] : null,
});

/** A form's rule as the API takes it: host lower case, methods in the usual order (or just `*`), no empty fields. */
export function ruleFromForm(f: RuleForm): EgressRule {
  const path = f.path.trim();
  const perRequest = !!f.placeholders;
  return {
    host: norm(f.host),
    methods: f.methods.includes(ANY_METHOD) ? [ANY_METHOD] : RULE_METHODS.filter((m) => f.methods.includes(m)),
    ...(path ? { path_prefix: path } : {}),
    ...(!perRequest && f.credential ? { credential: f.credential } : {}),
    ...(perRequest && f.placeholders?.length ? { placeholders: [...f.placeholders] } : {}),
  };
}

/** The forms as an allow-list, with each one's problem (index-aligned; undefined when fine). */
export function rulesFromForms(forms: RuleForm[]): {
  allow: EgressRule[];
  errors: (string | undefined)[];
  ok: boolean;
} {
  const allow = forms.map(ruleFromForm);
  const errors = allow.map(
    (r, i) =>
      ruleProblem(r) ??
      (forms[i].placeholders && !forms[i].placeholders?.length
        ? 'Pick the credentials the sandbox may name, or name one credential.'
        : null) ??
      undefined,
  );
  return { allow, errors, ok: errors.every((e) => !e) };
}

/** Whether two allow-lists say the same thing, rule by rule in order. */
export const sameRules = (a: EgressRule[], b: EgressRule[]): boolean => {
  const canon = (rs: EgressRule[]) => JSON.stringify(rs.map((r) => ruleFromForm(formFromRule(r))));
  return canon(a) === canon(b);
};
