import { makeAutoObservable, runInAction } from 'mobx';
import { AuthToken, AuthTokenOperation } from '@cere-ddc-sdk/ddc';
import Reporting from '@cluster-apps/reporting';

import { CERE_DECIMALS } from '~/constants';
import { createChainClient } from '~/storage/ddc/chainClient';
import { createBucketStorage } from '~/storage/ddc/bucketStorage';
import { createDdcSigner } from '~/storage/ddc/signer';
import { listOwnerBuckets } from '~/storage/ddc/ownerBuckets';
import { createGatewayClient } from '~/storage/ddc/gatewayClient';
import { gatewayPubKeyToSs58 } from '~/storage/ddc/gatewayCredential';
import type { CefSigner } from '@cef-ai/wallet';
import type { BucketInfo, BucketStorage } from '~/storage/ddc/types';
import type { Account, AccountStatus, Bucket, ReadyAccount, SessionInput } from './types';

const toCere = (units: bigint | null | undefined) =>
  units == null ? undefined : parseFloat((Number(units) / 10 ** CERE_DECIMALS).toFixed(2));

/**
 * The account store, revived on the current stack. The CEF wallet is hook-based
 * and lives in the React `SessionProvider`; this MobX store receives the
 * connected identity + signer/token accessors through `setSession` (the bridge
 * in App.tsx) and does all storage/chain work through the SDK-v3 ddc layer
 * (`~/storage/ddc/*`) -- the DDC S3 gateway for objects, the REST index for the
 * bucket list, the chain for deposit + bucket create/params.
 */
export class AccountStore implements Account {
  private chain = createChainClient();
  private gateway = createGatewayClient();
  readonly storage: BucketStorage = createBucketStorage(() => this.requireSigner());

  private session: SessionInput | null = null;
  private _buckets?: Bucket[];
  private _bucketsLoading = false;
  private _deposit?: bigint;
  private _balance?: bigint;

  constructor() {
    makeAutoObservable<AccountStore, 'chain' | 'gateway'>(this, { storage: false, chain: false, gateway: false });
  }

  /** Bridge: the React wallet SessionProvider pushes session changes here. */
  setSession(next: SessionInput | null) {
    const prev = this.session;
    this.session = next;
    const connected = next?.state === 'connected' && !!next.account;
    const changedAccount = prev?.account !== next?.account;
    if (connected && changedAccount) {
      void this.bootstrap();
    } else if (!connected) {
      this.cleanup();
    }
  }

  private requireSigner(): CefSigner {
    if (!this.session) throw new Error('Account is not ready');
    return this.session.getSigner();
  }

  /** The connected wallet as a DDC signer carrying a consent description. */
  private consentSigner(consent: string) {
    return createDdcSigner(() => this.requireSigner()).describing(consent);
  }

  /**
   * Kept for `AppStore.init()`: the wallet connects through the React
   * SessionProvider, so there is nothing to initialise in the store.
   */
  async init(): Promise<void> {}

  private async bootstrap() {
    await Promise.all([this.refreshBuckets(), this.refreshDeposit(), this.refreshBalance()]);
  }

  private cleanup() {
    runInAction(() => {
      this._buckets = undefined;
      this._deposit = undefined;
      this._balance = undefined;
      this._bucketsLoading = false;
    });
  }

  get status(): AccountStatus {
    return this.session?.state ?? 'idle';
  }
  get account() {
    return this.session?.account ?? undefined;
  }
  get address() {
    return this.session?.address ?? undefined;
  }
  get email() {
    return this.session?.email ?? undefined;
  }
  isReady(): this is ReadyAccount {
    return this.status === 'connected' && !!this.account;
  }

  get deposit() {
    return toCere(this._deposit);
  }
  get balance() {
    return toCere(this._balance);
  }
  get buckets() {
    return this._buckets;
  }
  get bucketsLoading() {
    return this._bucketsLoading;
  }

  async refreshBuckets() {
    const owner = this.session?.account;
    if (!owner) return;
    runInAction(() => {
      this._bucketsLoading = true;
    });
    try {
      // REST index (GET /v1/buckets?owner=), not the old full-chain getBucketList
      // scan. isPublic is not in the index; resolved on demand via getBucketInfo.
      const list = await listOwnerBuckets(owner);
      runInAction(() => {
        this._buckets = list.map<Bucket>((b) => ({ id: BigInt(b.id), isPublic: false, isRemoved: b.isRemoved }));
      });
    } catch (e) {
      Reporting.error(e);
    } finally {
      runInAction(() => {
        this._bucketsLoading = false;
      });
    }
  }

  private async refreshDeposit() {
    const addr = this.session?.address;
    if (!addr) return;
    try {
      const d = await this.chain.getDeposit(addr);
      runInAction(() => {
        this._deposit = d;
      });
    } catch (e) {
      Reporting.error(e);
    }
  }

  private async refreshBalance() {
    const addr = this.session?.address;
    if (!addr) return;
    try {
      const b = await this.chain.getBalance(addr);
      runInAction(() => {
        this._balance = b;
      });
    } catch (e) {
      Reporting.error(e);
    }
  }

  async getBucketInfo(bucketId: bigint): Promise<BucketInfo | undefined> {
    return this.chain.getBucket(bucketId);
  }

  async createBucket(params: { isPublic?: boolean }) {
    const bucketId = await this.chain.createBucket(this.consentSigner('Create a storage bucket'), {
      isPublic: params.isPublic ?? true,
    });
    // Register the new bucket at the gateway so objects can be put to it.
    try {
      await this.storage.createBucket(bucketId.toString());
    } catch (e) {
      Reporting.error(e);
    }
    await this.refreshBuckets();
    return bucketId;
  }

  async saveBucket(bucketId: bigint, params: { isPublic: boolean }) {
    await this.chain.setBucketAccess(bucketId, params.isPublic, this.consentSigner('Change bucket access'));
    // Mirror the on-chain flag at the gateway so object reads match.
    try {
      await this.storage.setBucketAcl(bucketId.toString(), params.isPublic ? 'public-read' : 'private');
    } catch (e) {
      Reporting.error(e);
    }
  }

  async topUp(amount: number) {
    const value = BigInt(Math.round(amount * 10 ** CERE_DECIMALS));
    await this.chain.deposit(value, this.consentSigner('Add a DDC deposit'));
    await Promise.all([this.refreshDeposit(), this.refreshBalance()]);
  }

  async createAuthToken(bucketId: bigint, pieceCid: string): Promise<string> {
    const token = new AuthToken({
      bucketId,
      pieceCid,
      operations: [AuthTokenOperation.GET],
      ...(this.address ? { subject: this.address } : {}),
    });
    await token.sign(createDdcSigner(() => this.requireSigner()));
    return token.toString();
  }

  /** Authorize the DDC storage gateway to act for this wallet (once per account). */
  async authorizeGateway() {
    const info = await this.gateway.getInfo();
    const ss58 = gatewayPubKeyToSs58(info.gatewayPublicKey);
    await this.chain.addProxy(ss58, this.consentSigner('Authorize the DDC storage gateway'));
  }
}
