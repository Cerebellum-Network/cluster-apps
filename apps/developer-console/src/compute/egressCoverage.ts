/**
 * Whether a bucket secret may be sent to the host of an egress rule that names
 * it. The same rules as the egress proxy and the resource manager (ddc-node
 * `cluster/egress-proxy/api/types.go`: `SecretHostMatches`, `SecretBoundTo`,
 * `SecretCoversRule`): a create whose rule names a secret that does not cover
 * the rule's host is refused with 400 `credential_not_bound`, and one naming a
 * secret the bucket lacks with 400 `unknown_credential`. The console checks
 * before it saves or runs, so the form can say which host to add.
 */
import type { SecretSummary } from './types';

const norm = (h: string) => h.trim().toLowerCase().replace(/\.$/, '');

/**
 * A secret's host pattern against a request host: exact, or `*.example.com`
 * for exactly one more label (`a.example.com`, not `a.b.example.com` or
 * `example.com`). Case and a trailing dot are ignored.
 */
export function secretHostMatches(pattern: string, host: string): boolean {
  const p = norm(pattern);
  const h = norm(host);
  if (!p || !h) return false;
  if (p.startsWith('*.')) {
    const suffix = p.slice(1);
    if (!h.endsWith(suffix)) return false;
    const label = h.slice(0, h.length - suffix.length);
    return label !== '' && !label.includes('.');
  }
  return p === h;
}

/**
 * Whether a secret bound to `hosts` covers every request a rule for `ruleHost`
 * can send it on: an exact rule host must be one of the hosts or match one of
 * their wildcards; a wildcard rule host must be listed as that same wildcard.
 */
export function secretCoversRule(hosts: string[], ruleHost: string): boolean {
  const r = norm(ruleHost);
  if (r.startsWith('*.')) return hosts.some((h) => norm(h) === r);
  return hosts.some((h) => secretHostMatches(h, r));
}

export type Coverage =
  /** The rule names no credential. */
  | { state: 'none' }
  /** The bucket's secrets are not known yet (still reading, or the read failed). */
  | { state: 'unknown' }
  /** The bucket holds no secret of that name: the create is refused with `unknown_credential`. */
  | { state: 'missing'; name: string }
  /** An older gateway lists no hosts, so the binding can't be told. */
  | { state: 'unlisted'; name: string }
  /** The secret is bound to no host (stored before secrets had hosts): it is sent nowhere. */
  | { state: 'unbound'; name: string }
  /** The secret is not bound to the rule's host: the create is refused with `credential_not_bound`. */
  | { state: 'not-covered'; name: string; hosts: string[]; host: string }
  | { state: 'covered'; name: string; hosts: string[] };

/** What happens to a rule for `host` that names `credential`, given the bucket's secrets. */
export function credentialCoverage(
  credential: string | null | undefined,
  host: string,
  secrets: SecretSummary[] | undefined,
): Coverage {
  const name = (credential ?? '').trim();
  if (!name) return { state: 'none' };
  if (!secrets) return { state: 'unknown' };
  const s = secrets.find((x) => x.name === name);
  if (!s) return { state: 'missing', name };
  if (!s.hosts) return { state: 'unlisted', name };
  if (s.hosts.length === 0) return { state: 'unbound', name };
  if (!norm(host) || secretCoversRule(s.hosts, host)) return { state: 'covered', name, hosts: s.hosts };
  return { state: 'not-covered', name, hosts: s.hosts, host: norm(host) };
}

/** A coverage that would make the create fail, or send the credential nowhere. */
export const coverageBlocks = (c: Coverage): boolean =>
  c.state === 'missing' || c.state === 'unbound' || c.state === 'not-covered';

/** The problem in words, or null when there is none. */
export function coverageProblem(c: Coverage): string | null {
  switch (c.state) {
    case 'missing':
      return `This bucket has no secret “${c.name}”. A run would be refused (unknown_credential): add it first.`;
    case 'unbound':
      return `“${c.name}” is bound to no host, so the proxy sends it nowhere. Store it again and name its hosts.`;
    case 'not-covered':
      return `“${c.name}” is sent only to ${c.hosts.join(', ')}, not to ${c.host}. A run would be refused (credential_not_bound): store it again with hosts ${[...c.hosts, c.host].join(', ')}.`;
    default:
      return null;
  }
}
