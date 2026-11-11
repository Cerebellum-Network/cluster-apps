import { makeAutoObservable, runInAction } from 'mobx';
import Reporting from '@cluster-apps/reporting';

import { CERE_DECIMALS } from '~/constants';
import { createChainClient } from '~/storage/ddc/chainClient';
import { createBucketStorage } from '~/storage/ddc/bucketStorage';
import { createDdcSigner } from '~/storage/ddc/signer';
import { createGatewayClient } from '~/storage/ddc/gatewayClient';
import { gatewayPubKeyToSs58 } from '~/storage/ddc/gatewayCredential';
import {
  addTrackedBucket,
  generateBucketName,
  isGatewayAuthorized,
  listTrackedBuckets,
  setGatewayAuthorized,
  updateTrackedBucket,
} from '~/storage/gatewayBuckets';
import type { CefSigner } from '@cef-ai/wallet';
import type { BucketStorage } from '~/storage/ddc/types';
import type { Account, AccountStatus, Bucket, ReadyAccount, SessionInput } from './types';

const toCere = (units: bigint | null | undefined) =>
  units == null ? undefined : parseFloat((Number(units) / 10 ** CERE_DECIMALS).toFixed(2));

/**
 * The account store, on the current stack. The CEF wallet is bridged in via
 * `setSession` (App.tsx). Storage goes through the DDC S3 gateway: buckets are
 * created through the gateway (addressed by name, after a one-time Proxy
 * authorization) and tracked client-side (`~/storage/gatewayBuckets`) because the
 * gateway has no "list my buckets". Deposit is read from chain.
 */
export class AccountStore implements Account {
  private chain = createChainClient();
  private gateway = createGatewayClient();
  readonly storage: BucketStorage = createBucketStorage(() => this.requireSigner());

  private session: SessionInput | null = null;
  private _buckets?: Bucket[];
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

  private requireAccount(): string {
    const acc = this.session?.account;
    if (!acc) throw new Error('Account is not ready');
    return acc;
  }

  /** The connected wallet as a DDC signer carrying a consent description. */
  private consentSigner(consent: string) {
    return createDdcSigner(() => this.requireSigner()).describing(consent);
  }

  /** Kept for AppStore.init(): the wallet connects through the React SessionProvider. */
  async init(): Promise<void> {}

  private async bootstrap() {
    this.refreshBuckets();
    await Promise.all([this.refreshDeposit(), this.refreshBalance()]);
  }

  private cleanup() {
    runInAction(() => {
      this._buckets = undefined;
      this._deposit = undefined;
      this._balance = undefined;
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
    return false;
  }

  /** Load the account's gateway buckets from the client-side track record. */
  refreshBuckets() {
    const acc = this.session?.account;
    runInAction(() => {
      this._buckets = acc
        ? listTrackedBuckets(acc).map<Bucket>((b) => ({ name: b.name, isPublic: b.isPublic }))
        : undefined;
    });
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

  /** Authorize the DDC storage gateway to act for this wallet (addProxy, once). */
  async authorizeGateway() {
    const acc = this.requireAccount();
    if (isGatewayAuthorized(acc)) return;
    const info = await this.gateway.getInfo();
    const ss58 = gatewayPubKeyToSs58(info.gatewayPublicKey);
    await this.chain.addProxy(ss58, this.consentSigner('Authorize the DDC storage gateway'));
    setGatewayAuthorized(acc);
  }

  /** Create a gateway bucket (authorizing the gateway first if needed). Returns its name. */
  async createBucket(): Promise<string> {
    const acc = this.requireAccount();
    await this.authorizeGateway();
    const name = generateBucketName();
    await this.storage.createBucket(name);
    addTrackedBucket(acc, name, false);
    this.refreshBuckets();
    return name;
  }

  async saveBucket(name: string, params: { isPublic: boolean }) {
    await this.storage.setBucketAcl(name, params.isPublic ? 'public-read' : 'private');
    updateTrackedBucket(this.requireAccount(), name, { isPublic: params.isPublic });
    this.refreshBuckets();
  }

  async topUp(amount: number) {
    const value = BigInt(Math.round(amount * 10 ** CERE_DECIMALS));
    await this.chain.deposit(value, this.consentSigner('Add a DDC deposit'));
    await Promise.all([this.refreshDeposit(), this.refreshBalance()]);
  }
}
