/**
 * The Create agent form and the `cere.agent/v1` document it saves. The form
 * holds what a person types (text for numbers and the command line); the
 * mapping turns it into the same JSON the import dialog and `cere agent push`
 * write to `cere/agents/<name>.json`, with the fields in the order of the
 * release's example definitions, and back. Fields the form doesn't edit
 * (`files`, and any it doesn't know) are kept as they were.
 */
import {
  AGENT_DEFAULT_RESOURCES,
  AGENT_MAX_TIMEOUT_S,
  AGENT_NAME_RE,
  AGENT_SCHEMA,
  validateAgentDefinition,
  type AgentDefinition,
  type Harness,
} from '~/compute/agentDefinition';
import { DEFAULT_AGENT_TIMEOUT_S } from '~/compute/agentRun';
import { credentialCoverage, type Coverage } from '~/compute/egressCoverage';
import { parseResources } from '~/compute/resources';
import { RULE_METHODS, type RuleForm } from '~/compute/egressRules';
import type { EgressRule, SecretSummary } from '~/compute/types';
import { quoteArg, splitCommand } from '../../Sandboxes/components/commandLine';

/** The agent runner image the claude-code harness runs in (the release's examples use it). */
export const RUNNER_IMAGE = 'cerebellumnetwork/ddc-agent-runner:0.1.1';
/** Claude Code's tools, as the runner names them (ddc-node packages/agent-runner, `TOOL_NAMES`). */
export const CLAUDE_CODE_TOOLS = ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Bash', 'Write', 'Edit'];
/** The runner's defaults when a definition leaves them out. */
export const DEFAULTS = {
  maxTurns: 30,
  cpu: AGENT_DEFAULT_RESOURCES.cpu,
  memoryMib: AGENT_DEFAULT_RESOURCES.memoryMib,
  timeoutS: DEFAULT_AGENT_TIMEOUT_S,
} as const;
export { RULE_METHODS, emptyRule, type RuleForm } from '~/compute/egressRules';

export interface AgentForm {
  name: string;
  description: string;
  systemPrompt: string;
  harness: Harness;
  image: string;
  /** The container harness's command line, split like a shell would (no expansion). */
  command: string;
  baseUrl: string;
  model: string;
  /** The bucket secret the proxy adds on calls to the model host. */
  modelCredential: string;
  tools: string[];
  policy: 'read-only' | 'read-write';
  /** One regular expression per line, matched against the agent's shell commands. */
  deny: string;
  maxTurns: string;
  /** The request: guaranteed, and the least a run is billed. */
  cpu: string;
  memoryMib: string;
  /** The limits: '' = the cluster's defaults (the node's quota; the larger of the memory request and 1 GiB). */
  cpuLimit: string;
  memoryLimitMib: string;
  timeoutS: string;
  rules: RuleForm[];
  /** Not edited by the form; kept as they were. */
  files: Record<string, string>;
  /** Fields the form doesn't know, kept as they were. */
  extra: Record<string, unknown>;
}

export type FormErrors = Partial<
  Record<
    | 'name'
    | 'image'
    | 'command'
    | 'baseUrl'
    | 'model'
    | 'maxTurns'
    | 'cpu'
    | 'memoryMib'
    | 'cpuLimit'
    | 'memoryLimitMib'
    | 'timeoutS'
    | 'deny',
    string
  >
> & {
  /** Per rule, by index. */
  rules?: (string | undefined)[];
  /** What the contract check found that no field shows. */
  other?: string[];
};

/** A new agent: the runner, the given model, the runner's defaults. */
export function emptyForm(model: { baseUrl: string; model: string; credential: string }): AgentForm {
  return {
    name: '',
    description: '',
    systemPrompt: '',
    harness: 'claude-code',
    image: RUNNER_IMAGE,
    command: '',
    baseUrl: model.baseUrl,
    model: model.model,
    modelCredential: model.credential,
    tools: ['Read', 'Grep', 'Glob', 'WebFetch'],
    policy: 'read-only',
    deny: '',
    maxTurns: String(DEFAULTS.maxTurns),
    cpu: String(DEFAULTS.cpu),
    memoryMib: String(DEFAULTS.memoryMib),
    cpuLimit: '',
    memoryLimitMib: '',
    timeoutS: String(DEFAULTS.timeoutS),
    rules: [],
    files: {},
    extra: {},
  };
}

const KNOWN = new Set([
  'schema',
  'name',
  'description',
  'harness',
  'image',
  'command',
  'system_prompt',
  'model',
  'tools',
  'policy',
  'deny',
  'max_turns',
  'resources',
  'timeout_s',
  'egress',
  'files',
]);

/** An existing definition in the form, for editing. */
export function formFromDefinition(def: AgentDefinition): AgentForm {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(def)) if (!KNOWN.has(k)) extra[k] = v;
  return {
    name: def.name,
    description: def.description ?? '',
    systemPrompt: def.system_prompt ?? '',
    harness: def.harness,
    image: def.image,
    command: (def.command ?? []).map(quoteArg).join(' '),
    baseUrl: def.model.base_url,
    model: def.model.model,
    modelCredential: def.model.credential ?? '',
    tools: [...(def.tools ?? [])],
    policy: def.policy === 'read-write' ? 'read-write' : 'read-only',
    deny: (def.deny ?? []).join('\n'),
    maxTurns: String(def.max_turns ?? DEFAULTS.maxTurns),
    cpu: String(def.resources?.cpu ?? DEFAULTS.cpu),
    memoryMib: String(def.resources?.memory_mib ?? DEFAULTS.memoryMib),
    cpuLimit: def.resources?.cpu_limit ? String(def.resources.cpu_limit) : '',
    memoryLimitMib: def.resources?.memory_limit_mib ? String(def.resources.memory_limit_mib) : '',
    timeoutS: String(def.timeout_s ?? DEFAULTS.timeoutS),
    rules: (def.egress?.allow ?? []).map((r) => ({
      host: r.host,
      methods: [...r.methods],
      path: r.path_prefix ?? '',
      credential: r.credential ?? '',
    })),
    files: { ...(def.files ?? {}) },
    extra,
  };
}

const HOST_LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/** A rule host the egress proxy accepts: a lower-case DNS name or IP address, or `*.` and at least two labels. */
export function ruleHostError(host: string): string | null {
  if (!host) return 'A host is required.';
  if (/[/:@\s]/.test(host)) return `“${host}” is not a host name: use names like api.github.com, not URLs.`;
  const name = host.startsWith('*.') ? host.slice(2) : host;
  if (host.startsWith('*.') && !name.includes('.')) return 'A wildcard needs at least two labels after it.';
  if (name.length > 253 || !name.split('.').every((l) => HOST_LABEL.test(l)))
    return `“${host}” is not a valid host name.`;
  return null;
}

const num = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/**
 * The form as a `cere.agent/v1` definition, or the problems that stop it.
 * `def` is set only when nothing stops it; it passes the same check the
 * import dialog and the run use. `draft` is the document as it stands, for
 * the preview.
 */
export function definitionFromForm(form: AgentForm): {
  def: AgentDefinition | null;
  draft: AgentDefinition;
  errors: FormErrors;
} {
  const errors: FormErrors = {};
  const name = form.name.trim();
  if (!AGENT_NAME_RE.test(name)) errors.name = 'Lowercase letters, digits and dashes, up to 63; it is the file name.';
  const image = form.image.trim();
  if (!image) errors.image = 'An image is required.';

  let command: string[] | null = null;
  if (form.harness === 'container') {
    const c = splitCommand(form.command);
    if (c.error) errors.command = c.error;
    else if (c.args.length === 0) errors.command = 'The container harness runs this command; it is required.';
    else command = c.args;
  }

  const baseUrl = form.baseUrl.trim().replace(/\/+$/, '');
  try {
    const u = new URL(baseUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') errors.baseUrl = 'An http(s) URL.';
  } catch {
    errors.baseUrl = 'The model’s Anthropic-compatible base URL, e.g. https://inference-gateway.…/anthropic.';
  }
  const model = form.model.trim();
  if (!model) errors.model = 'A model name is required.';

  const maxTurns = num(form.maxTurns);
  if (maxTurns === null || !Number.isInteger(maxTurns) || maxTurns < 1) errors.maxTurns = 'A whole number, 1 or more.';
  const cpu = num(form.cpu);
  if (cpu === null || !(cpu > 0)) errors.cpu = 'More than 0 vCPU.';
  const memory = num(form.memoryMib);
  if (memory === null || !Number.isInteger(memory) || memory < 128) errors.memoryMib = 'At least 128 MiB.';
  // The limits, checked against the request as typed (or the runner's default where that is not usable).
  const limits = parseResources(
    { cpu: '', memoryMib: '', cpuLimit: form.cpuLimit, memoryLimitMib: form.memoryLimitMib },
    { cpu: cpu && cpu > 0 ? cpu : DEFAULTS.cpu, memoryMib: memory && memory >= 128 ? memory : DEFAULTS.memoryMib },
  );
  if (limits.errors.cpuLimit) errors.cpuLimit = limits.errors.cpuLimit;
  if (limits.errors.memoryLimitMib) errors.memoryLimitMib = limits.errors.memoryLimitMib;
  const timeout = num(form.timeoutS);
  if (timeout === null || !Number.isInteger(timeout) || timeout < 1 || timeout > AGENT_MAX_TIMEOUT_S)
    errors.timeoutS = `1 to ${AGENT_MAX_TIMEOUT_S} seconds.`;

  const deny = form.deny
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const badDeny = deny.find((p) => {
    try {
      new RegExp(p);
      return false;
    } catch {
      return true;
    }
  });
  if (badDeny) errors.deny = `“${badDeny}” is not a regular expression.`;

  const ruleErrors: (string | undefined)[] = [];
  const allow: EgressRule[] = [];
  form.rules.forEach((r, i) => {
    const host = r.host.trim().toLowerCase().replace(/\.$/, '');
    const path = r.path.trim();
    const err =
      ruleHostError(host) ??
      (r.methods.length === 0 ? 'Pick at least one method.' : null) ??
      (path && !path.startsWith('/') ? 'A path prefix starts with /.' : null);
    if (err) ruleErrors[i] = err;
    allow.push({
      host,
      methods: RULE_METHODS.filter((m) => r.methods.includes(m)),
      ...(path ? { path_prefix: path } : {}),
      ...(r.credential ? { credential: r.credential } : {}),
    });
  });
  if (ruleErrors.length) errors.rules = ruleErrors;

  const description = form.description.trim();
  const systemPrompt = form.systemPrompt.trim();
  const def = {
    schema: AGENT_SCHEMA,
    name,
    ...(description ? { description } : {}),
    harness: form.harness,
    image,
    command,
    ...(systemPrompt ? { system_prompt: form.systemPrompt } : {}),
    model: { base_url: baseUrl, model, ...(form.modelCredential ? { credential: form.modelCredential } : {}) },
    tools: [...form.tools],
    policy: form.policy,
    deny,
    max_turns: maxTurns ?? DEFAULTS.maxTurns,
    resources: {
      cpu: cpu ?? DEFAULTS.cpu,
      memory_mib: memory ?? DEFAULTS.memoryMib,
      ...(limits.resources.cpu_limit ? { cpu_limit: limits.resources.cpu_limit } : {}),
      ...(limits.resources.memory_limit_mib ? { memory_limit_mib: limits.resources.memory_limit_mib } : {}),
    },
    timeout_s: timeout ?? DEFAULTS.timeoutS,
    egress: { allow },
    files: { ...form.files },
    ...form.extra,
  } as AgentDefinition;

  const fieldErrors = Object.keys(errors).length > 0;
  if (!fieldErrors) {
    const contract = validateAgentDefinition(def);
    if (contract.length) errors.other = contract;
  }
  return { def: Object.keys(errors).length ? null : def, draft: def, errors };
}

/** The model host as the run adds it: the base URL's host. */
export function modelHost(baseUrl: string): string {
  try {
    return new URL(baseUrl.trim()).hostname;
  } catch {
    return '';
  }
}

/** Each credential the form names against the bucket's secrets: the model's, then each rule's by index. */
export function formCoverage(
  form: Pick<AgentForm, 'baseUrl' | 'modelCredential' | 'rules'>,
  secrets: SecretSummary[] | undefined,
): { model: Coverage; rules: Coverage[] } {
  return {
    model: credentialCoverage(form.modelCredential, modelHost(form.baseUrl), secrets),
    rules: form.rules.map((r) => credentialCoverage(r.credential, r.host, secrets)),
  };
}
