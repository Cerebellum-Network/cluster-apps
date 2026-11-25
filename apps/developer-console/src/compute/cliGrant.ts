/**
 * Browser sign-in for the `cere` CLI (`cere login`).
 *
 * The CLI makes its own ed25519 key pair, listens on 127.0.0.1, and opens
 * `/cli/authorize?key=<its public key, hex>&state=…&port=…&code=…&host=…&days=…`.
 * When the bucket's owner approves, the wallet signs a **grant**: a COMPUTE
 * token for the bucket whose `subject` is the CLI's key (and which may
 * delegate). The console hands the grant to the CLI in a POST body (a top-level
 * form submission to the loopback port, which Chrome's Local Network Access
 * does not gate), or shows it for pasting when the CLI runs elsewhere
 * (`--no-browser`). The CLI then signs a child token under it with its private
 * key and presents that chain; the compute gateway refuses a grant naming a
 * subject when it is presented alone, so the grant is useless without the
 * CLI's key, wherever it is seen.
 */
import { AuthToken } from '@cere-ddc-sdk/ddc';
import { encodeAddress, type Signer } from '@cere-ddc-sdk/blockchain';

import { COMPUTE_OPERATIONS } from '~/inference/inferenceKey';

export const GRANT_DAYS = [1, 7, 30] as const;
export type GrantDays = (typeof GRANT_DAYS)[number];
export const DAY_MS = 86_400_000;

export interface CliRequest {
  /** The CLI's ed25519 public key, 64 lower-case hex characters. */
  key: string;
  /** Echoed back to the CLI, which refuses a callback without it. */
  state: string;
  /** Loopback port to deliver to; null: show the grant for pasting. */
  port: number | null;
  /** The code the terminal shows, to compare; null when the CLI sent none. */
  code: string | null;
  /** The machine's name as the CLI reported it (a hint, not verified). */
  host: string | null;
  days: GrantDays;
}

const HEX_KEY = /^[0-9a-f]{64}$/;
const STATE = /^[A-Za-z0-9_-]{16,128}$/;
const CODE = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** The sign-in request in an `/cli/authorize` URL, or why it is not one. */
export function parseCliRequest(params: URLSearchParams): { ok: true; req: CliRequest } | { ok: false; error: string } {
  const key = (params.get('key') ?? '').toLowerCase();
  if (!HEX_KEY.test(key)) return { ok: false, error: 'It names no CLI key (64 hex characters).' };
  const state = params.get('state') ?? '';
  if (!STATE.test(state)) return { ok: false, error: 'Its state is missing or malformed.' };
  const portText = params.get('port');
  let port: number | null = null;
  if (portText !== null && portText !== '') {
    port = Number(portText);
    if (!/^\d{1,5}$/.test(portText) || port < 1024 || port > 65535)
      return { ok: false, error: 'Its port is not a local port.' };
  }
  const codeText = params.get('code');
  const code = codeText && CODE.test(codeText) ? codeText : null;
  if (codeText && !code) return { ok: false, error: 'Its confirmation code is malformed.' };
  const hostText = (params.get('host') ?? '').trim();
  const host = /^[A-Za-z0-9._-]{1,64}$/.test(hostText) ? hostText : null;
  const daysText = Number(params.get('days') ?? '7');
  const days = (GRANT_DAYS as readonly number[]).includes(daysText) ? (daysText as GrantDays) : 7;
  return { ok: true, req: { key, state, port, code, host, days } };
}

const hexToBytes = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (b) => parseInt(b, 16));

/** The CLI key as people compare it: the first and last 8 hex characters. */
export const keyFingerprint = (hex: string) => `${hex.slice(0, 8)}…${hex.slice(-8)}`;

/**
 * Sign the grant for the CLI's key: COMPUTE only, on `bucketId`, until
 * `expiresInMs` from now, delegable to the key it names and to nothing else.
 * `signer` must be the bucket's owner. Returns the base58 token.
 */
export async function buildCliGrant(
  signer: Signer,
  { bucketId, cliKey, expiresInMs }: { bucketId: bigint; cliKey: string; expiresInMs: number },
): Promise<string> {
  if (!HEX_KEY.test(cliKey)) throw new Error('not a CLI key');
  const token = new AuthToken({
    bucketId,
    operations: [...COMPUTE_OPERATIONS],
    expiresIn: expiresInMs,
    subject: encodeAddress(hexToBytes(cliKey)),
    canDelegate: true,
  });
  await token.sign(signer);
  return token.toString();
}

/** Where the CLI listens for the grant. */
export const loopbackCallback = (port: number) => `http://127.0.0.1:${port}/callback`;

/**
 * Hand fields to the CLI: a POST form submitted as a top-level navigation, so
 * nothing lands in a URL and the CLI's own page ("signed in, close this tab")
 * replaces this one.
 */
export function postToCli(port: number, fields: Record<string, string>, doc: Document = document): void {
  const form = doc.createElement('form');
  form.method = 'POST';
  form.action = loopbackCallback(port);
  form.style.display = 'none';
  for (const [name, value] of Object.entries(fields)) {
    const input = doc.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  doc.body.appendChild(form);
  form.submit();
}
