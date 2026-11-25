import type { AgentDefinition } from '~/compute/agentDefinition';
import type { SecretSummary } from '~/compute/types';

/** The bucket secrets a definition's run needs: the model's credential and every egress rule's. */
export function neededSecrets(def: AgentDefinition): string[] {
  const names = [def.model.credential, ...(def.egress?.allow ?? []).map((r) => r.credential)];
  return [...new Set(names.filter((n): n is string => !!n))];
}

/** Those the bucket does not hold: a create naming them is refused with 400 `unknown_credential`. */
export function missingSecrets(def: AgentDefinition, have: SecretSummary[] | undefined): string[] {
  if (!have) return [];
  return neededSecrets(def).filter((n) => !have.some((s) => s.name === n));
}

export const agentPath = (bucket: string, name: string) =>
  `/agents/a/${encodeURIComponent(bucket)}/${encodeURIComponent(name)}`;

/**
 * The Developer Console of the network a DDC inference gateway serves, or null
 * for any other host. Both are deployed under one ingress host per network:
 * `inference-gateway.<host>` and `developer.<host>` (the cere CLI derives it
 * the same way, client/cere/agent/secrets.go).
 */
export function consoleForGateway(host: string): string | null {
  const prefix = 'inference-gateway.';
  return host.startsWith(prefix) && host.length > prefix.length
    ? `https://developer.${host.slice(prefix.length)}`
    : null;
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
};

/** The example definitions' model gateway (ddc-node client/examples/agents): devnet's inference gateway. */
export const EXAMPLE_MODEL_URL = 'https://inference-gateway.compute.dev.ddcdragon.com/anthropic';

/**
 * Whether a model at `baseUrl` is on this console's own inference gateway, which takes this console's COMPUTE token
 * for the bucket as its key (and bills the calls to the same bucket).
 */
export function onConsoleGateway(baseUrl: string, inferenceGatewayUrl: string): boolean {
  const host = hostOf(baseUrl);
  return !!host && host === hostOf(inferenceGatewayUrl);
}

/** What a secret a definition names is for, and where its value comes from when that can be told. */
export type SecretPurpose =
  | {
      kind: 'model';
      name: string;
      model: string;
      baseUrl: string;
      host: string;
      /** The model's gateway is this console's own inference gateway: it takes this console's token as the key. */
      sameConsole: boolean;
      /** The console of the gateway's network, when it is a DDC inference gateway of another network. */
      console: string | null;
    }
  | {
      kind: 'rule';
      name: string;
      hosts: string[];
      /** Where the value comes from, for a service the console knows (GitHub). */
      source: { what: string; url: string } | null;
    };

/** Where a credential for these hosts comes from, for the services the examples use (as the CLI says it). */
export function credentialSource(hosts: string[]): { what: string; url: string } | null {
  if (hosts.some((h) => h === 'api.github.com' || h === 'github.com'))
    return {
      what: 'a GitHub fine-grained personal access token with read-only access, to public repositories or to the ones the agent reads (not your gh login’s token, which carries all its scopes)',
      url: 'https://github.com/settings/personal-access-tokens/new',
    };
  return null;
}

export function secretPurpose(def: AgentDefinition, name: string, inferenceGatewayUrl: string): SecretPurpose {
  if (name === def.model.credential) {
    const host = hostOf(def.model.base_url);
    const sameConsole = onConsoleGateway(def.model.base_url, inferenceGatewayUrl);
    return {
      kind: 'model',
      name,
      model: def.model.model,
      baseUrl: def.model.base_url,
      host,
      sameConsole,
      console: sameConsole ? null : consoleForGateway(host),
    };
  }
  const hosts = [...new Set((def.egress?.allow ?? []).filter((r) => r.credential === name).map((r) => r.host))];
  return { kind: 'rule', name, hosts, source: credentialSource(hosts) };
}
