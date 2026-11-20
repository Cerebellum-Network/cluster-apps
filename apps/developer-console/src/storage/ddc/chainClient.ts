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
import { connect, createCustomerDepositContract } from '@cere-ddc-sdk/blockchain';
import type {
  Bucket,
  BucketParams,
  CereClient,
  CereNetwork,
  ClusterId,
  CustomerDepositContract,
} from '@cere-ddc-sdk/blockchain';
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

// Customer-deposit ink! contract reader (SDK v3). On devnet/testnet (and mainnet)
// DAC debits the account's deposit from THIS contract, and the fiat bridge's
// `deposit_for` funds it -- NOT the legacy `ddcCustomers` pallet. So the deposit
// the console gates on must be read from the contract; a card top-up lands here,
// while `getStackingInfo` (the pallet) would read an unrelated, usually-empty
// ledger. The contract address is resolved from the cluster's gov params and
// cached by the SDK. The pallet read stays only as a fallback for a cluster that
// has no deposit contract configured.
let depositContract: CustomerDepositContract | null = null;
function customerDeposit(): CustomerDepositContract {
  if (!depositContract) depositContract = createCustomerDepositContract(client().api);
  return depositContract;
}

function toBucketInfo(b: Bucket): BucketInfo {
  return { bucketId: b.bucketId, ownerId: b.ownerId, isPublic: b.isPublic, isRemoved: b.isRemoved };
}

export function createChainClient(): ChainClient {
  return {
    async getDeposit(address) {
      // Prefer the deposit CONTRACT (where fiat top-ups land and DAC debits).
      // `resolve` is cached; `readBalance` returns undefined for an account with
      // no deposit (clean 0) and throws only on a failed dry run, which the
      // caller already treats as "deposit unknown" rather than zero.
      const contractAddr = await customerDeposit().resolve(clusterId());
      if (contractAddr) {
        const info = await customerDeposit().readBalance(contractAddr, address);
        return BigInt(info?.active ?? 0n);
      }
      // No deposit contract on this cluster -> legacy pallet ledger.
      const info = await client().customers.getStackingInfo(clusterId(), address);
      return BigInt(info?.active ?? 0n);
    },

    async getBalance(address) {
      // Free (spendable) CERE balance of the wallet, for the top-up "Max" hint.
      // Best-effort: the top-up flow tolerates an unknown balance, so any query
      // failure degrades to 0 rather than breaking the screen.
      try {
        const acc = await (
          client().api.query as unknown as { System: { Account: (a: string) => Promise<unknown> } }
        ).System.Account(address);
        const free = (acc as { data?: { free?: bigint } } | undefined)?.data?.free;
        return BigInt(free ?? 0n);
      } catch {
        return 0n;
      }
    },

    async setBucketAccess(bucketId, isPublic, signer) {
      // Flip a bucket's on-chain public/private flag (Content Delivery). Extrinsic
      // -> the signer must carry a consent description.
      await client().tx.send(client().customers.setBucketParams(bucketId, { isPublic }), { signer });
    },

    async deposit(value: bigint, signer: Signer, caller: string) {
      // Lock `value` (chain's smallest unit) from the caller's balance as a
      // new/topped-up deposit. Extrinsic -> the signer must carry a consent
      // description.
      const contractAddr = await customerDeposit().resolve(clusterId());
      if (contractAddr) {
        // Deposit into the customer-deposit CONTRACT -- where DAC debits and where
        // `getDeposit` now reads, so a CERE top-up lands in the same place a card
        // top-up does (and not in the pallet ledger the console no longer reads).
        // `sizeCall` dry-runs to size gas AND an explicit storage-deposit ceiling
        // (never None: devnet reads None as a zero ceiling and rejects the
        // ledger-creating first deposit). It never throws -- it degrades to a
        // generous sizing. One dry-run precedes signing; on the default iframe
        // transport that is within the user-activation window (popup transport is
        // the tight case -- see addProxy). The message takes no args; `value`
        // carries the deposit.
        const MSG = 'DdcBalancesDepositor::deposit';
        const sizing = await customerDeposit().sizeCall(contractAddr, MSG, caller, value, {});
        const sendable = customerDeposit().buildContractCall(contractAddr, MSG, value, {}, sizing);
        await client().tx.send(sendable, { signer });
        return;
      }
      // No deposit contract on this cluster -> legacy pallet deposit.
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

    async removeProxy(delegateSs58: string, signer: Signer) {
      // Revoke the gateway's proxy. `remove_proxy` matches on the full triple
      // (delegate, proxy_type, delay), so these MUST equal what addProxy sent or
      // the chain finds no proxy to remove (NotFound). Extrinsic -> the signer
      // must carry a consent description.
      const tx = client().api.tx.Proxy.remove_proxy({
        delegate: { type: 'Id', value: delegateSs58 },
        proxy_type: { type: 'NonTransfer', value: undefined },
        delay: 0,
      });
      const result = await client().tx.send(tx, { signer });
      return result.txHash;
    },
  };
}
