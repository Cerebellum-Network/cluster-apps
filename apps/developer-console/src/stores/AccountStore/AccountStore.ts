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
  clearGatewayAuthorized,
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
  private _gatewayAuthorized = false;

  constructor() {
    makeAutoObservable<AccountStore, 'chain' | 'gateway'>(this, { storage: false, chain: false, gateway: false });
  }

  /** Bridge: the React wallet SessionProvider pushes session changes here. */
  setSession(next: SessionInput | null) {
    const prev = this.session;
    this.session = next;
    const connected = next?.state === 'connected' && !!next.account;
    const changedAccount = prev?.account !== next?.account;
    // A different (or no) account must not reuse the previous wallet's gateway credential.
    if (changedAccount) this.storage.resetCredentials();
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
    const acc = this.session?.account;
    runInAction(() => {
      this._gatewayAuthorized = acc ? isGatewayAuthorized(acc) : false;
    });
    this.refreshBuckets();
    await Promise.all([this.refreshDeposit(), this.refreshBalance()]);
  }

  private cleanup() {
    runInAction(() => {
      this._buckets = undefined;
      this._deposit = undefined;
      this._balance = undefined;
      this._gatewayAuthorized = false;
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
  /** Whether this wallet has authorized the storage gateway (observable). */
  get gatewayAuthorized() {
    return this._gatewayAuthorized;
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
    try {
      await this.chain.addProxy(
        ss58,
        this.consentSigner('Allow Cere to manage your storage for you. You can turn this off anytime in Settings.'),
      );
    } catch (e) {
      // `Proxy.Duplicate` means the gateway is already a proxy for this wallet,
      // i.e. already authorized — not an error. Anything else is real.
      if (!/duplicate/i.test((e as Error)?.message ?? '')) throw e;
    }
    setGatewayAuthorized(acc);
    runInAction(() => {
      this._gatewayAuthorized = true;
    });
  }

  /**
   * Revoke the storage gateway's authorization: remove its on-chain proxy and
   * drop the local authorized flag + cached credential. After this the gateway
   * can no longer act for the wallet; the next create re-authorizes.
   */
  async revokeGateway() {
    const acc = this.requireAccount();
    const info = await this.gateway.getInfo();
    const ss58 = gatewayPubKeyToSs58(info.gatewayPublicKey);
    try {
      await this.chain.removeProxy(ss58, this.consentSigner('Revoke the DDC storage gateway authorization'));
    } catch (e) {
      // `NotFound` means there is no such proxy -- already revoked. Treat as done;
      // anything else is real.
      if (!/not ?found/i.test((e as Error)?.message ?? '')) throw e;
    }
    clearGatewayAuthorized(acc);
    this.storage.resetCredentials();
    runInAction(() => {
      this._gatewayAuthorized = false;
    });
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
    // Name the amount in the wallet consent so the user approves a known figure,
    // not an opaque "add a deposit" (#185 review).
    await this.chain.deposit(value, this.consentSigner(`Add a ${amount} CERE deposit to DDC`));
    await Promise.all([this.refreshDeposit(), this.refreshBalance()]);
  }
}
