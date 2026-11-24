/**
 * Agent definitions in the customer's buckets, through the DDC S3 gateway
 * (storage/ddc/bucketStorage.ts, the wallet's gateway credential):
 *
 *   cere/agents/<name>.json          a definition (`cere.agent/v1`)
 *   cere/runs/<sandbox-id>/<file>    a run's output.json and transcript.jsonl (run step 6)
 *
 * A wallet can have several gateway buckets; definitions are read from all of
 * them, so whichever bucket the CLI pushed to (`cere agent push`) shows here.
 */
import type { BucketStorage, StorageObject } from '~/storage/ddc/types';
import { AGENTS_PREFIX, agentKey, parseAgentDefinition, runPrefix, type AgentDefinition } from './agentDefinition';

export interface StoredAgent {
  /** The S3-gateway bucket name it was read from. */
  bucket: string;
  key: string;
  /** The definition's name, or the file's when it could not be read. */
  name: string;
  def: AgentDefinition | null;
  /** Why it can't be run, when it can't. */
  errors: string[];
}

const nameFromKey = (key: string) => key.slice(AGENTS_PREFIX.length).replace(/\.json$/, '');

type Store = Pick<BucketStorage, 'listObjects' | 'readObject' | 'uploadObject' | 'deleteObject'>;

/** Every `cere/agents/*.json` in `buckets`, parsed and checked. One unreadable bucket does not hide the others. */
export async function listAgents(
  storage: Store,
  buckets: string[],
): Promise<{ agents: StoredAgent[]; failed: { bucket: string; error: string }[] }> {
  const failed: { bucket: string; error: string }[] = [];
  const perBucket = await Promise.all(
    buckets.map(async (bucket) => {
      let objects: StorageObject[];
      try {
        objects = await storage.listObjects(bucket, AGENTS_PREFIX);
      } catch (e) {
        failed.push({ bucket, error: e instanceof Error ? e.message : String(e) });
        return [];
      }
      const files = objects.filter((o) => o.key.endsWith('.json') && !o.key.slice(AGENTS_PREFIX.length).includes('/'));
      return Promise.all(files.map((o) => readStored(storage, bucket, o.key)));
    }),
  );
  const agents = perBucket.flat().sort((a, b) => a.name.localeCompare(b.name) || a.bucket.localeCompare(b.bucket));
  return { agents, failed };
}

async function readStored(storage: Store, bucket: string, key: string): Promise<StoredAgent> {
  try {
    const text = await (await storage.readObject(bucket, key)).text();
    const { def, errors } = parseAgentDefinition(text);
    const fileName = nameFromKey(key);
    if (def && def.name !== fileName) {
      return {
        bucket,
        key,
        name: def.name,
        def: null,
        errors: [`The file is ${key} but its "name" is "${def.name}".`],
      };
    }
    return { bucket, key, name: def?.name ?? fileName, def, errors };
  } catch (e) {
    return {
      bucket,
      key,
      name: nameFromKey(key),
      def: null,
      errors: [`Couldn’t read it: ${e instanceof Error ? e.message : String(e)}`],
    };
  }
}

/** Write a definition to `cere/agents/<name>.json` (private). */
export async function saveAgent(storage: Store, bucket: string, def: AgentDefinition): Promise<string> {
  const key = agentKey(def.name);
  await storage.uploadObject({
    bucketName: bucket,
    key,
    body: `${JSON.stringify(def, null, 2)}\n`,
    contentType: 'application/json',
    acl: 'private',
  });
  return key;
}

export async function deleteAgent(storage: Store, bucket: string, name: string): Promise<void> {
  await storage.deleteObject(bucket, agentKey(name));
}

/** Run step 6: copy a run's files to `cere/runs/<sandbox-id>/`. */
export async function saveRunFiles(
  storage: Store,
  bucket: string,
  sandboxId: string,
  files: { name: string; body: string }[],
): Promise<string[]> {
  const keys: string[] = [];
  for (const f of files) {
    const key = `${runPrefix(sandboxId)}${f.name}`;
    await storage.uploadObject({
      bucketName: bucket,
      key,
      body: f.body,
      contentType: f.name.endsWith('.json') ? 'application/json' : 'application/x-ndjson',
      acl: 'private',
    });
    keys.push(key);
  }
  return keys;
}

/** A run's file from the bucket copy, from whichever of `buckets` has it; null when none does. */
export async function readRunFile(
  storage: Store,
  buckets: string[],
  sandboxId: string,
  name: string,
): Promise<{ bucket: string; text: string } | null> {
  for (const bucket of buckets) {
    try {
      const objects = await storage.listObjects(bucket, runPrefix(sandboxId));
      const key = `${runPrefix(sandboxId)}${name}`;
      if (!objects.some((o) => o.key === key)) continue;
      return { bucket, text: await (await storage.readObject(bucket, key)).text() };
    } catch {
      /* this bucket can't be read; try the next */
    }
  }
  return null;
}
