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
