import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useSession } from '../wallet/session';
import { Btn, Card, MessageCard, Mono, Overline, Skel, TagPill, TextLink } from '../components/ui';
import { short } from '../lib/format';
import { createBucketStorage } from './ddc/bucketStorage';
import { gatewayPubKeyToSs58 } from './ddc/gatewayCredential';
import type { Acl } from './ddc/types';
import { useAuthorizeGateway, useBucketsStats, useCreateBucket, useDeposit, useGatewayInfo, useMakeDeposit, useOwnerBuckets, storageUsageAvailable } from './queries';

/** Human-readable byte size (binary units). */
function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 || v >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Message for a failed extrinsic. The embed-wallet transport can stop waiting
 * for the signature and surface "request timed out" even though the extrinsic
 * was already submitted and lands on chain (the deposit is debited the fee), so
 * a bare timeout here is misleading. Tell the user the write may have gone
 * through and to reload, rather than implying it failed.
 */
function txErrorMessage(e: unknown): string {
  const msg = (e as Error)?.message ?? 'unknown';
  if (/tim(e|ed)\s?-?\s?out|timeout/i.test(msg)) {
    return `${msg} — the wallet stopped waiting for the signature, but the transaction may already have been submitted. Wait ~15s and reload to check before retrying.`;
  }
  return msg;
}

/**
 * Developer Console -- Storage (Phase 0 slice).
 *
 * On the current DDC SDK (v3) against Dragon 1, reusing this console's CEF wallet:
 * read the deposit and bucket list, create a bucket on chain, and upload /
 * download / share files through the DDC S3 gateway. See STORAGE-SLICE.md.
 */
export function StoragePage() {
  const s = useSession();
  const buckets = useOwnerBuckets(s.account);
  // Per-bucket storage usage from the DAC stats API (empty endpoint → disabled).
  const bucketIds = useMemo(() => (buckets.data ?? []).map((b) => BigInt(b.id)), [buckets.data]);
  const usage = useBucketsStats(bucketIds);
  const usageTotal = useMemo(
    () => (usage.data ?? []).reduce((t, u) => t + (u.storedBytes || 0), 0),
    [usage.data],
  );
  // The chain reads the deposit by SS58 address, not the hex public key the
  // index/gateway key accounts by.
  const deposit = useDeposit(s.address);
  const makeDeposit = useMakeDeposit(s.getSigner, s.address);
  const [depositAmount, setDepositAmount] = useState('');

  // `s.getSigner` is a fresh closure on every session-value recompute, so build
  // storage once and always read the current signer through a ref -- otherwise the
  // instance (and its cached gateway credential) would be thrown away on session
  // churn, re-registering the credential on each upload.
  const getSignerRef = useRef(s.getSigner);
  useEffect(() => {
    getSignerRef.current = s.getSigner;
  }, [s.getSigner]);
  // Latest-ref pattern: the ref is only read when resolveSigner is CALLED (at
  // upload/sign time), never during render. (oxlint's react(refs) flags the
  // textual `.current` here regardless; the access is safe.)
  const resolveSigner = useCallback(() => getSignerRef.current(), []);
  const storage = useMemo(() => createBucketStorage(resolveSigner), [resolveSigner]);

  const [bucketId, setBucketId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [acl, setAcl] = useState<Acl>('private');
  const [uploaded, setUploaded] = useState<{ bucket: string; key: string; url: string; acl: Acl } | null>(null);

  // A chain bucket prefills the files bucket; a gateway bucket (below) sets the name.
  const createBucket = useCreateBucket(s.getSigner, s.account, (id) => setBucketId(id.toString()));

  const [files, setFiles] = useState<string[] | null>(null);

  // Credentials are cached after the first gateway call, so refreshing the list
  // after an upload/delete needs no extra wallet signature.
  const refreshFiles = useMutation({
    mutationFn: () => storage.listObjects(bucketId.trim()),
    onSuccess: (keys) => setFiles(keys),
  });

  const upload = useMutation({
    mutationFn: async () => {
      const bucket = bucketId.trim();
      if (!bucket) throw new Error('Enter a bucket id.');
      if (!file) throw new Error('Pick a file.');
      await storage.uploadObject({ bucketName: bucket, key: file.name, body: file, acl });
      // Capture the bucket used, so the public link points at it even if the field changes.
      const url = acl === 'public-read' ? storage.publicUrl(bucket, file.name) : '';
      return { bucket, key: file.name, url, acl };
    },
    onSuccess: (r) => {
      setUploaded(r);
      refreshFiles.mutate();
    },
  });

  // Read one object and hand it to the browser as a download.
  const download = useMutation({
    mutationFn: async (key: string) => {
      const blob = await storage.readObject(bucketId.trim(), key);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = key;
      a.click();
      URL.revokeObjectURL(href);
    },
  });

  const deleteFile = useMutation({
    mutationFn: (key: string) => storage.deleteObject(bucketId.trim(), key),
    onSuccess: () => refreshFiles.mutate(),
  });

  // A storage bucket must be created THROUGH the gateway (it mints on-chain + the
  // gateway row). Derive a stable S3-valid name from the wallet.
  const gwBucketName = s.account ? `dc-${s.account.slice(0, 40)}` : '';
  const createGwBucket = useMutation({
    mutationFn: async () => {
      await storage.createBucket(gwBucketName);
      return gwBucketName;
    },
    onSuccess: (name) => setBucketId(name),
  });
  const gwInfo = useGatewayInfo();
  const gatewaySs58 = gwInfo.data ? gatewayPubKeyToSs58(gwInfo.data.gatewayPublicKey) : undefined;
  const authorizeGateway = useAuthorizeGateway(s.getSigner, gatewaySs58);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Overline>Storage</Overline>
        <Mono style={{ fontSize: 12, color: 'var(--b-tx2)' }}>{short(s.account, 6, 4)}</Mono>
      </div>

      <Card style={{ marginTop: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong>DDC deposit</strong>
          <TagPill>chain read</TagPill>
        </div>
        <p style={{ margin: '8px 0 0', color: 'var(--b-tx2)' }}>
          {deposit.isLoading && 'Reading from chain…'}
          {deposit.isError && 'Could not read the deposit from chain.'}
          {deposit.data !== undefined && (
            <>
              <Mono>{deposit.data.toString()}</Mono> raw chain units in the configured cluster.
            </>
          )}
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <label style={{ display: 'grid', gap: 4, font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Add deposit (CERE)
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="e.g. 10"
              inputMode="decimal"
              style={{ padding: '8px 10px', border: '1px solid var(--b-line)', borderRadius: 8, font: '400 14px/1 var(--font-mono)', width: 140 }}
            />
          </label>
          <Btn
            variant="primary"
            size="sm"
            onClick={() => makeDeposit.mutate(depositAmount)}
            disabled={makeDeposit.isPending || !depositAmount.trim()}
          >
            {makeDeposit.isPending ? 'Depositing…' : 'Deposit'}
          </Btn>
        </div>
        <p style={{ margin: '6px 0 0', font: '400 12px/1.4 var(--font-sans)' }}>
          {makeDeposit.isError && (
            <span style={{ color: 'var(--b-err-tx)' }}>Deposit failed: {txErrorMessage(makeDeposit.error)}</span>
          )}
          {makeDeposit.isSuccess && <span style={{ color: 'var(--b-ok-tx)' }}>Deposit submitted.</span>}
        </p>
      </Card>

      <Card style={{ marginTop: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong>Your buckets</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TagPill>via blockchain index</TagPill>
            <Btn variant="primary" size="xs" onClick={() => createBucket.mutate()} disabled={createBucket.isPending}>
              {createBucket.isPending ? 'Creating…' : 'Create bucket'}
            </Btn>
          </div>
        </div>
        {createBucket.isSuccess && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-ok-tx)' }}>
            Created bucket <Mono>#{createBucket.data.toString()}</Mono>.
          </p>
        )}
        {createBucket.isError && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-err-tx)' }}>
            Create failed: {txErrorMessage(createBucket.error)}
          </p>
        )}

        {buckets.isLoading && (
          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            <Skel w="100%" h={40} />
            <Skel w="100%" h={40} />
          </div>
        )}

        {buckets.isError && (
          <div style={{ marginTop: 16 }}>
            <MessageCard
              glyph="!"
              iconBg="var(--b-err-bg)"
              iconTx="var(--b-err-tx)"
              title="Could not load your buckets."
              body="The blockchain index did not respond. Sign-in and your deposit are not affected."
              cta="Retry"
              onCta={() => void buckets.refetch()}
            />
          </div>
        )}

        {buckets.data && buckets.data.length === 0 && (
          <p style={{ marginTop: 16, color: 'var(--b-tx2)' }}>No buckets yet. Create one above.</p>
        )}

        {buckets.data && buckets.data.length > 0 && (
          <ul style={{ listStyle: 'none', margin: '16px 0 0', padding: 0, display: 'grid', gap: 8 }}>
            {buckets.data.map((b) => (
              <li
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  border: '1px solid var(--b-line)',
                  borderRadius: 8,
                }}
              >
                <Mono>#{b.id}</Mono>
                {!b.hasBalance && <TagPill>no balance</TagPill>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card style={{ marginTop: 12, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong>Storage usage</strong>
          <TagPill>via activity / metrics</TagPill>
        </div>
        {!storageUsageAvailable() && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-tx2)' }}>
            Storage usage isn’t available for this network yet — the DAC stats endpoint is not configured.
          </p>
        )}
        {storageUsageAvailable() && bucketIds.length === 0 && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-tx2)' }}>No buckets to report usage for.</p>
        )}
        {storageUsageAvailable() && bucketIds.length > 0 && usage.isLoading && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-tx2)' }}>Loading usage…</p>
        )}
        {storageUsageAvailable() && usage.isError && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-err-tx)' }}>
            Could not load usage: {(usage.error as Error)?.message ?? 'unknown'}
          </p>
        )}
        {storageUsageAvailable() && usage.data && usage.data.length > 0 && (
          <>
            <p style={{ margin: '8px 0 0', color: 'var(--b-tx2)' }}>
              <Mono>{formatBytes(usageTotal)}</Mono> stored across {usage.data.length} bucket
              {usage.data.length === 1 ? '' : 's'}.
            </p>
            <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'grid', gap: 8 }}>
              {usage.data.map((u) => (
                <li
                  key={u.bucketId.toString()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    border: '1px solid var(--b-line)',
                    borderRadius: 8,
                  }}
                >
                  <Mono>#{u.bucketId.toString()}</Mono>
                  <span style={{ color: 'var(--b-tx2)', font: '400 12px/1.4 var(--font-sans)' }}>
                    {formatBytes(u.storedBytes)} stored · {formatBytes(u.transferredBytes)} out · {u.puts} puts · {u.gets} gets
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {storageUsageAvailable() && usage.data && usage.data.length === 0 && bucketIds.length > 0 && !usage.isLoading && (
          <p style={{ margin: '8px 0 0', color: 'var(--b-tx2)' }}>No usage recorded for your buckets yet.</p>
        )}
      </Card>

      <Card style={{ marginTop: 16, padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <strong>Files</strong>
          <TagPill>via DDC S3 gateway</TagPill>
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 14, maxWidth: 520 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Btn
              variant="outline"
              size="xs"
              onClick={() => authorizeGateway.mutate()}
              disabled={authorizeGateway.isPending || !gatewaySs58}
            >
              {authorizeGateway.isPending ? 'Authorizing…' : 'Authorize gateway (one-time)'}
            </Btn>
            <Btn
              variant="secondary"
              size="xs"
              onClick={() => createGwBucket.mutate()}
              disabled={createGwBucket.isPending || !gwBucketName}
            >
              {createGwBucket.isPending ? 'Creating…' : 'Create gateway bucket'}
            </Btn>
            <Mono style={{ fontSize: 12, color: 'var(--b-tx2)' }}>{gwBucketName}</Mono>
          </div>
          {authorizeGateway.isSuccess && (
            <p style={{ margin: 0, color: 'var(--b-ok-tx)' }}>Gateway authorized as a proxy.</p>
          )}
          {authorizeGateway.isError && (
            <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>
              Authorize failed: {txErrorMessage(authorizeGateway.error)}
            </p>
          )}
          {createGwBucket.isError && (
            <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>
              Gateway bucket failed: {txErrorMessage(createGwBucket.error)}
            </p>
          )}
          {createGwBucket.isSuccess && (
            <p style={{ margin: 0, color: 'var(--b-ok-tx)' }}>Gateway bucket ready.</p>
          )}

          <label style={{ display: 'grid', gap: 4, font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Bucket id / name
            <input
              value={bucketId}
              onChange={(e) => setBucketId(e.target.value)}
              placeholder="e.g. 576130 or dc-…"
              style={{ padding: '8px 10px', border: '1px solid var(--b-line)', borderRadius: 8, font: '400 14px/1 var(--font-mono)' }}
            />
          </label>

          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

          <label style={{ display: 'grid', gap: 4, font: '500 12px/1 var(--font-sans)', color: 'var(--b-tx2)' }}>
            Visibility
            <select
              value={acl}
              onChange={(e) => setAcl(e.target.value as Acl)}
              style={{ padding: '8px 10px', border: '1px solid var(--b-line)', borderRadius: 8, font: '400 14px/1 var(--font-sans)' }}
            >
              <option value="private">Private (signed read)</option>
              <option value="public-read">Public (readable via CDN)</option>
            </select>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="primary" size="sm" onClick={() => upload.mutate()} disabled={upload.isPending || !file}>
              {upload.isPending ? 'Uploading…' : 'Upload'}
            </Btn>
            <Btn
              variant="outline"
              size="sm"
              onClick={() => refreshFiles.mutate()}
              disabled={refreshFiles.isPending || !bucketId.trim()}
            >
              {refreshFiles.isPending ? 'Loading…' : 'List files'}
            </Btn>
          </div>

          {upload.isError && (
            <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>Upload failed: {(upload.error as Error)?.message ?? 'unknown'}</p>
          )}
          {uploaded && (
            <p style={{ margin: 0, color: 'var(--b-tx2)' }}>
              Uploaded <Mono>{uploaded.key}</Mono>{' '}
              {uploaded.acl === 'public-read' ? (
                <>
                  — <TextLink href={uploaded.url} target="_blank" rel="noreferrer">Public link</TextLink>
                </>
              ) : (
                '— private (use Download)'
              )}
            </p>
          )}
          {refreshFiles.isError && (
            <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>List failed: {(refreshFiles.error as Error)?.message ?? 'unknown'}</p>
          )}
          {download.isError && (
            <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>Download failed: {(download.error as Error)?.message ?? 'unknown'}</p>
          )}
          {deleteFile.isError && (
            <p style={{ margin: 0, color: 'var(--b-err-tx)' }}>Delete failed: {(deleteFile.error as Error)?.message ?? 'unknown'}</p>
          )}

          {files && files.length === 0 && (
            <p style={{ margin: 0, color: 'var(--b-tx2)' }}>No files in this bucket.</p>
          )}
          {files && files.length > 0 && (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
              {files.map((k) => (
                <li
                  key={k}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 10px',
                    border: '1px solid var(--b-line)',
                    borderRadius: 8,
                  }}
                >
                  <Mono style={{ fontSize: 12, wordBreak: 'break-all' }}>{k}</Mono>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <Btn variant="outline" size="xs" onClick={() => download.mutate(k)} disabled={download.isPending}>
                      Download
                    </Btn>
                    <Btn variant="tertiary" size="xs" onClick={() => deleteFile.mutate(k)} disabled={deleteFile.isPending}>
                      Delete
                    </Btn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </>
  );
}
