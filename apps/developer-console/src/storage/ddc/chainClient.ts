/**
 * On-chain bucket + deposit operations via SDK v3.
 *
 * Ported from ROC (roc/src/features/account/chainClient.ts), trimmed to the three
 * operations this slice needs: deposit read, bucket read, bucket create.
 *
 * Notes carried over from ROC:
 *   - `connect({ network })` opens the WS synchronously; the readiness wait
 *     happens inside `client.tx.send` on first use. There is no isReady()/handshake.
 *   - Do NOT call `client.disconnect()` on page teardown -- the client is a
 *     tab-lifetime singleton and the WS dies with the page. (MIGRATION.md's
 *     "disconnect now required" is about wallet disconnect, not page teardown.)
 *   - Writes take the signer as an argument, never captured at construction, so
 *     `signer.describing('<consent>')` can ride on each extrinsic.
 *
 * `createBucket` is an extrinsic: the `signer` passed MUST already carry a consent
 * description (e.g. `createDdcSigner(session.getSigner).describing('Create a
 * storage bucket')`), or CefDdcSigner.sign refuses it.
 */
import { connect } from '@cere-ddc-sdk/blockchain';
import type { Bucket, BucketParams, CereClient, CereNetwork, ClusterId } from '@cere-ddc-sdk/blockchain';
import { config } from '../../config';
import { storageConfig } from '../storageConfig';
import type { BucketInfo, ChainClient, Signer } from './types';

function resolveNetwork(n: string): CereNetwork {
  return n === 'devnet' || n === 'mainnet' ? n : 'testnet';
}

// Tab-lifetime singleton: connect() opens one WS for the page (see note above).
let singleton: CereClient | null = null;
function client(): CereClient {
  if (!singleton) singleton = connect({ network: resolveNetwork(config.network) });
  return singleton;
}

const clusterId = (): ClusterId => storageConfig.clusterId as ClusterId;

function toBucketInfo(b: Bucket): BucketInfo {
  return { bucketId: b.bucketId, ownerId: b.ownerId, isPublic: b.isPublic, isRemoved: b.isRemoved };
}

export function createChainClient(): ChainClient {
  return {
    async getDeposit(address) {
      const info = await client().customers.getStackingInfo(clusterId(), address);
      return BigInt(info?.active ?? 0n);
    },

    async deposit(value: bigint, signer: Signer) {
      // Lock `value` (chain's smallest unit) from the signer's balance as a
      // new/topped-up deposit in the configured cluster. Extrinsic -> the signer
      // must carry a consent description.
      const tx = await client().customers.deposit(clusterId(), value, {});
      await client().tx.send(tx, { signer });
    },

    async getBucket(bucketId) {
      const b = await client().customers.getBucket(bucketId);
      return b ? toBucketInfo(b) : undefined;
    },

    async createBucket(signer: Signer, options) {
      const params: BucketParams = { isPublic: options?.isPublic ?? false };
      const result = await client().tx.send(client().customers.createBucket(clusterId(), params), { signer });
      const [bucketId] = client().customers.extractCreatedBucketIds(result.events);
      // The tx can finalize without a BucketCreated event (e.g. a silent on-chain
      // failure); surface that rather than returning undefined as a bigint.
      if (bucketId === undefined) {
        throw new Error('Bucket creation finalized but no BucketCreated event was found.');
      }
      return bucketId;
    },

    async addProxy(delegateSs58: string, signer: Signer) {
      // The DDC S3 gateway creates buckets on the wallet's behalf via Proxy.proxy,
      // so the wallet must add the gateway's address as a NonTransfer proxy first.
      // Ported from ROC chainClient.addProxy. `delegate` is a MultiAddress enum
      // (Id variant takes SS58, not a hex public key).
      //
      // No assertCompatible() here on purpose: on popup-transport the wallet must
      // open its consent popup within the click gesture, so the signing call must
      // be reached with as little `await` before it as possible. The extra
      // compatibility round-trip pushed the popup past the gesture window, which
      // the wallet surfaced as a stuck "waiting for host".
      const tx = client().api.tx.Proxy.add_proxy({
        delegate: { type: 'Id', value: delegateSs58 },
        proxy_type: { type: 'NonTransfer', value: undefined },
        delay: 0,
      });
      const result = await client().tx.send(tx, { signer });
      return result.txHash;
    },
  };
}
