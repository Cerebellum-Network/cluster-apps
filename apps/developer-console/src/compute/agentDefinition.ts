/**
 * The agent layer's definition document, `cere.agent/v1` (build design,
 * Section 3.9). It is client-side only: DDC's servers know nothing about
 * agents. A definition is a JSON document in the customer's bucket at
 * `cere/agents/<name>.json`; a run is a sandbox labelled `cere.*`.
 */
import type { EgressRule, HttpMethod } from './types';

export const AGENT_SCHEMA = 'cere.agent/v1';

export type Harness = 'claude-code' | 'container';

export interface AgentModel {
  /** The Anthropic-compatible endpoint, e.g. `https://inference-gateway.…/anthropic`. */
  base_url: string;
  model: string;
  /** The bucket secret the egress proxy injects on calls to the model host. */
  credential?: string;
}

export interface AgentDefinition {
  schema: typeof AGENT_SCHEMA;
  name: string;
  description?: string;
  harness: Harness;
  image: string;
  /** Required for `container`; ignored for `claude-code` (the runner is exec'd). */
  command?: string[] | null;
  system_prompt?: string;
  model: AgentModel;
  tools?: string[];
  policy?: string;
  deny?: string[];
  max_turns?: number;
  resources?: { cpu?: number; memory_mib?: number };
  timeout_s?: number;
  egress?: { allow: EgressRule[] };
  /** Extra files put into the sandbox before the run: path (relative = under /workspace) → content. */
  files?: Record<string, string>;
}

/** Usable as a file name in the bucket and as a label value; the same rule as the CLI. */
export const AGENT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}$/;
/** The longest a sandbox may live (`SANDBOX_MAX_TIMEOUT`). */
export const AGENT_MAX_TIMEOUT_S = 24 * 3600;
export const AGENT_POLICIES = ['read-only', 'read-write'];

const METHODS: HttpMethod[] = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Check a parsed document against `cere.agent/v1`. Returns the problems in
 * plain words; an empty list means the run algorithm can use it as is.
 */
export function validateAgentDefinition(doc: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(doc)) return ['The definition is not a JSON object.'];
  if (doc.schema !== AGENT_SCHEMA) errs.push(`"schema" must be "${AGENT_SCHEMA}".`);
  if (typeof doc.name !== 'string' || !AGENT_NAME_RE.test(doc.name))
    errs.push('"name" must be lowercase letters, digits and dashes (up to 63).');
  if (doc.harness !== 'claude-code' && doc.harness !== 'container')
    errs.push('"harness" must be "claude-code" or "container".');
  if (typeof doc.image !== 'string' || !doc.image.trim()) errs.push('"image" is required.');
  if (doc.harness === 'container' && !(isStrArray(doc.command) && doc.command.length > 0))
    errs.push('"command" is required for the container harness.');
  if (!isObj(doc.model)) errs.push('"model" must be an object with base_url, model and credential.');
  else {
    const m = doc.model;
    let url: URL | null = null;
    try {
      url = typeof m.base_url === 'string' ? new URL(m.base_url) : null;
    } catch {
      url = null;
    }
    if (!url || (url.protocol !== 'https:' && url.protocol !== 'http:'))
      errs.push('"model.base_url" must be an http(s) URL.');
    if (typeof m.model !== 'string' || !m.model) errs.push('"model.model" is required.');
    if (m.credential !== undefined && typeof m.credential !== 'string') errs.push('"model.credential" names a secret.');
  }
  if (doc.tools !== undefined && !isStrArray(doc.tools)) errs.push('"tools" must be a list of tool names.');
  const t = doc.timeout_s;
  if (t !== undefined && !(typeof t === 'number' && t >= 0 && t <= AGENT_MAX_TIMEOUT_S))
    errs.push(`"timeout_s" must be between 0 and ${AGENT_MAX_TIMEOUT_S} seconds.`);
  if (doc.policy !== undefined && doc.policy !== '' && !AGENT_POLICIES.includes(String(doc.policy)))
    errs.push(`"policy" must be ${AGENT_POLICIES.map((p) => `"${p}"`).join(' or ')}.`);
  if (doc.max_turns !== undefined && !(typeof doc.max_turns === 'number' && doc.max_turns >= 0))
    errs.push('"max_turns" must not be negative.');
  if (doc.resources !== undefined) {
    if (!isObj(doc.resources)) errs.push('"resources" must be an object.');
    else {
      const { cpu, memory_mib } = doc.resources;
      if (cpu !== undefined && !(typeof cpu === 'number' && cpu > 0)) errs.push('"resources.cpu" must be positive.');
      if (memory_mib !== undefined && !(typeof memory_mib === 'number' && memory_mib >= 128))
        errs.push('"resources.memory_mib" must be at least 128.');
    }
  }
  if (doc.egress !== undefined) {
    const allow = isObj(doc.egress) ? doc.egress.allow : undefined;
    if (!Array.isArray(allow)) errs.push('"egress.allow" must be a list of rules.');
    else
      allow.forEach((r, i) => {
        if (!isObj(r) || typeof r.host !== 'string' || !r.host) errs.push(`"egress.allow[${i}].host" is required.`);
        else if (!isStrArray(r.methods) || !r.methods.every((x) => METHODS.includes(x as HttpMethod)))
          errs.push(`"egress.allow[${i}].methods" must be upper-case HTTP methods.`);
      });
  }
  if (doc.files !== undefined && !(isObj(doc.files) && Object.values(doc.files).every((v) => typeof v === 'string')))
    errs.push('"files" must map paths to text content.');
  else if (isObj(doc.files))
    for (const p of Object.keys(doc.files))
      if (!p || p.includes('..')) errs.push(`"files": "${p}" is not a usable path.`);
  return errs;
}

/** Parse and validate a definition's JSON text. */
export function parseAgentDefinition(text: string): { def: AgentDefinition | null; errors: string[] } {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    return { def: null, errors: [`Not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const errors = validateAgentDefinition(doc);
  return { def: errors.length ? null : (doc as AgentDefinition), errors };
}

/** Where a definition lives in a bucket. */
export const agentKey = (name: string) => `cere/agents/${name}.json`;
export const AGENTS_PREFIX = 'cere/agents/';
/** Where a run's outputs are copied in the bucket (run step 6). */
export const runPrefix = (sandboxId: string) => `cere/runs/${sandboxId}/`;
