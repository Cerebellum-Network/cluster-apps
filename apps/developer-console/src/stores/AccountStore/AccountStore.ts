import { makeAutoObservable, runInAction } from 'mobx';
import Reporting from '@cluster-apps/reporting';

import { CERE_DECIMALS } from '~/constants';
import { createChainClient } from '~/storage/ddc/chainClient';
import { createBucketStorage } from '~/storage/ddc/bucketStorage';
import { createDdcSigner } from '~/storage/ddc/signer';
import { createGatewayClient } from '~/storage/ddc/gatewayClient';
import { gatewayPubKeyToSs58 } from '~/storage/ddc/gatewayCredential';
import { generateBucketName } from '~/storage/gatewayBuckets';
import type { CefSigner } from '@cef-ai/wallet';
import type { BucketStorage } from '~/storage/ddc/types';
import type { Account, AccountStatus, Bucket, ReadyAccount, SessionInput } from './types';

const toCere = (units: bigint | null | undefined) =>
  units == null ? undefined : parseFloat((Number(units) / 10 ** CERE_DECIMALS).toFixed(2));

/**
 * The account store, on the current stack. The CEF wallet is bridged in via
 * `setSession` (App.tsx). Storage goes through the DDC S3 gateway: buckets are
 * created through the gateway (addressed by name, after a one-time Proxy
 * authorization). The bucket list and each bucket's public/private flag are read
 * from the gateway itself (ListBuckets / GetBucketAcl), and the proxy state from
 * `/auth/status` -- nothing is tracked in localStorage. Deposit is read from chain.
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
  private _gatewayAuthorized = false;

  constructor() {
    makeAutoObservable<AccountStore, 'chain' | 'gateway'>(this, { storage: false, chain: false, gateway: false });
  }

  /** Bridge: the React wallet SessionProvider pushes session changes here. */
  setSession(next: SessionInput | null) {
    const prev = this.session;
    this.session = next;
    const prevAcc = prev?.account ?? null;
    const nextAcc = next?.account ?? null;
    const connected = next?.state === 'connected' && !!nextAcc;
    // Only a genuine switch to a DIFFERENT wallet must drop the in-memory
    // credential -- NOT the initial connect (null -> x) or a transient resume
    // (x -> null), which previously wiped it and forced a fresh signature on every
    // reload (#188 review). The persisted per-account credential is kept either way.
    if (prevAcc && nextAcc && prevAcc !== nextAcc) this.storage.resetCredentials();
    if (connected && prevAcc !== nextAcc) {
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
    if (acc) {
      // Read the proxy state from the gateway, not a local flag, so a returning
      // device doesn't get a needless re-grant prompt.
      this.storage
        .isGatewayAuthorized()
        .then((ok) => runInAction(() => (this._gatewayAuthorized = ok)))
        .catch((e) => Reporting.error(e));
    }
    await Promise.all([this.refreshBuckets(), this.refreshDeposit(), this.refreshBalance()]);
  }

  private cleanup() {
    runInAction(() => {
      this._buckets = undefined;
      this._bucketsLoading = false;
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
    return this._bucketsLoading;
  }
  /** Whether this wallet has authorized the storage gateway (observable). */
  get gatewayAuthorized() {
    return this._gatewayAuthorized;
  }

  /** Load the account's buckets from the gateway (ListBuckets + GetBucketAcl). */
  async refreshBuckets() {
    if (!this.session?.account) {
      runInAction(() => {
        this._buckets = undefined;
      });
      return;
    }
    runInAction(() => {
      this._bucketsLoading = true;
    });
    try {
      const names = await this.storage.listBuckets();
      const buckets = await Promise.all(
        names.map(async (name) => {
          let isPublic = false;
          try {
            isPublic = (await this.storage.getBucketAcl(name)) === 'public-read';
          } catch (e) {
            Reporting.error(e); // an ACL read failure defaults to private, not a broken list
          }
          return { name, isPublic } satisfies Bucket;
        }),
      );
      runInAction(() => {
        this._buckets = buckets;
      });
    } catch (e) {
      Reporting.error(e);
      // Keep whatever we had rather than flipping a populated list to empty.
      runInAction(() => {
        this._buckets = this._buckets ?? [];
      });
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

  /** Authorize the DDC storage gateway to act for this wallet (addProxy, once). */
  async authorizeGateway() {
    this.requireAccount();
    // Ask the gateway whether the proxy already exists (new device, or a prior
    // grant) before prompting -- avoids a needless add_proxy popup and fee.
    if (await this.storage.isGatewayAuthorized()) {
      runInAction(() => {
        this._gatewayAuthorized = true;
      });
      return;
    }
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
    runInAction(() => {
      this._gatewayAuthorized = true;
    });
  }

  /**
   * Revoke the storage gateway's authorization: remove its on-chain proxy AND
   * delete the gateway credential (removeProxy alone leaves the credential working
   * -- data ops for up to 24h, index ops indefinitely). After this the gateway can
   * no longer act for the wallet; the next create re-authorizes.
   */
  async revokeGateway() {
    const info = await this.gateway.getInfo();
    const ss58 = gatewayPubKeyToSs58(info.gatewayPublicKey);
    try {
      await this.chain.removeProxy(ss58, this.consentSigner('Revoke the DDC storage gateway authorization'));
    } catch (e) {
      // `NotFound` means there is no such proxy -- already revoked. Treat as done;
      // anything else is real.
      if (!/not ?found/i.test((e as Error)?.message ?? '')) throw e;
    }
    try {
      await this.storage.revokeCredentials();
    } catch (e) {
      Reporting.error(e); // best-effort: the proxy is already gone, which is the main effect
    }
    runInAction(() => {
      this._gatewayAuthorized = false;
    });
  }

  /** Create a gateway bucket (authorizing the gateway first if needed). Returns its name. */
  async createBucket(): Promise<string> {
    this.requireAccount();
    await this.authorizeGateway();
    const name = generateBucketName();
    await this.storage.createBucket(name);
    await this.refreshBuckets();
    return name;
  }

  async saveBucket(name: string, params: { isPublic: boolean }) {
    await this.storage.setBucketAcl(name, params.isPublic ? 'public-read' : 'private');
    await this.refreshBuckets();
  }

  async topUp(amount: number) {
    const value = BigInt(Math.round(amount * 10 ** CERE_DECIMALS));
    // Name the amount in the wallet consent so the user approves a known figure,
    // not an opaque "add a deposit" (#185 review).
    await this.chain.deposit(value, this.consentSigner(`Add a ${amount} CERE deposit to DDC`));
    await Promise.all([this.refreshDeposit(), this.refreshBalance()]);
  }
}
