import { makeAutoObservable, reaction, when } from 'mobx';
import { fromPromise, IPromiseBasedObservable, IResource, keepAlive } from 'mobx-utils';
import { EmbedWallet, UserInfo } from '@cere/embed-wallet';
import { AuthToken, AuthTokenOperation, CereWalletSigner, DdcClient } from '@cere-ddc-sdk/ddc-client';
import { AuthTokenParams } from '@cere-ddc-sdk/ddc';
import { Blockchain, BucketParams } from '@cere-ddc-sdk/blockchain';
import { BucketStats, IndexedAccount } from '@cluster-apps/api';
import Reporting from '@cluster-apps/reporting';

import {
  APP_ENV,
  APP_ID,
  CERE_DECIMALS,
  DDC_CLUSTER_ID,
  DDC_PRESET,
  DDC_SDK_LOG_LEVEL,
  DDC_BLOCKCHAIN_MAX_RETRIES,
  DDC_BLOCKCHAIN_RETRY_DELAY,
} from '~/constants';
import { WALLET_INIT_OPTIONS, WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, ConnectOptions, AccountMetrics, Bucket } from './types';
import {
  createAccountResource,
  createAccountMetricsResource,
  createAddressResource,
  createStatusResource,
  createBucketStatsResource,
  createClusterAccountResource,
} from './resources';

export class AccountStore implements Account {
  readonly blockchain = new Blockchain({ wsEndpoint: DDC_PRESET.blockchain });
  readonly wallet = new EmbedWallet({ appId: APP_ID, env: APP_ENV });
  readonly signer = new CereWalletSigner(this.wallet, { autoConnect: false });
  readonly ddc = new DdcClient(this.signer, {
    blockchain: this.blockchain,
    logLevel: DDC_SDK_LOG_LEVEL,
    blockchainRetryConfig: {
      maxRetries: DDC_BLOCKCHAIN_MAX_RETRIES,
      retryDelay: DDC_BLOCKCHAIN_RETRY_DELAY,
    },
  });

  private bcReadyPromise = fromPromise(Promise.all([this.blockchain.isReady(), this.signer.isReady()]));
  private statusResource = createStatusResource(this);
  private addressResource = createAddressResource(this);
  private accountResource?: IResource<IndexedAccount | undefined>;
  private clusterAccountResource?: IResource<IndexedAccount | undefined>;
  private userInfoPromise?: IPromiseBasedObservable<UserInfo>;
  private accountMetricsResource?: IResource<AccountMetrics | undefined>;
  private bucketsStatsResource?: IResource<BucketStats[] | undefined>;

  constructor() {
    makeAutoObservable(this, {
      wallet: false,
      blockchain: false,
    });
    this.startAutoCacheCleaning();

    keepAlive(this, 'status');
    keepAlive(this, 'address');

    reaction(
      () => this.address && this.status === 'connected',
      (isConnected) => (isConnected ? this.bootstrap() : this.cleanup()),
    );

    reaction(
      () => this.buckets?.length,
      () => {
        this.bucketsStatsResource = createBucketStatsResource(this);
      },
    );

    /**
     * Track user changes and update the user in the reporting
     */
    reaction(
      () => this.userInfo,
      (userInfo) =>
        !userInfo
          ? Reporting.clearUser()
          : Reporting.setUser({ id: this.address!, email: userInfo.email, username: userInfo.name }),
    );

    /**
     * Report an error if the blockchain is not ready after 30s
     */
    when(() => this.bcReadyPromise.state === 'fulfilled', { timeout: 30000 }).catch(() => {
      Reporting.message(`Blockchain is not ready after 30s`, 'warning');
    });
  }

  private async bootstrap() {
    this.accountResource = createAccountResource(this);
    this.clusterAccountResource = createClusterAccountResource(this);
    this.accountMetricsResource = createAccountMetricsResource(this);
    this.userInfoPromise = fromPromise(this.wallet.getUserInfo());
  }

  private async cleanup() {
    this.userInfoPromise = undefined;
    this.accountResource = undefined;
    this.clusterAccountResource = undefined;
    this.accountMetricsResource = undefined;
  }

  /**
   * Start automatic cache clearing to prevent stale data issues
   */
  private startAutoCacheCleaning() {
    const CACHE_CLEAR_INTERVAL = 2 * 60 * 1000; // 2 minutes

    // Clear cache every 2 minutes
    setInterval(() => {
      try {
        if (this.ddc && typeof this.ddc.clearPingCache === 'function') {
          this.ddc.clearPingCache();
          console.log('[AutoCache] Ping cache cleared automatically');
        }

        // Also expose manual clearing functions to window for debugging
        if (typeof window !== 'undefined') {
          (window as any).clearDdcCache = () => {
            if (this.ddc && typeof this.ddc.clearPingCache === 'function') {
              this.ddc.clearPingCache();
              console.log('[Manual] DDC cache cleared');
            }
          };

          (window as any).getCacheInfo = () => {
            if (this.ddc && typeof this.ddc.getPingCacheInfo === 'function') {
              const info = this.ddc.getPingCacheInfo();
              console.log('[CacheInfo] Current cache state:', info);
              return info;
            }
            return null;
          };
        }
      } catch (error) {
        console.warn('[AutoCache] Failed to clear cache:', error);
      }
    }, CACHE_CLEAR_INTERVAL);
  }

  private getBucketStats(bucketId: bigint) {
    const stats = this.bucketsStatsResource?.current();

    return (
      stats &&
      (stats.find((stats) => stats.bucketId === bucketId) || {
        bucketId,
        gets: 0,
        puts: 0,
        storedBytes: 0,
        transferredBytes: 0,
      })
    );
  }

  isReady(): this is ReadyAccount {
    return !!this.userInfo && !!this.buckets;
  }

  get status() {
    return this.statusResource.current();
  }

  get metrics() {
    return this.accountMetricsResource?.current();
  }

  get address() {
    return this.addressResource.current();
  }

  get balance() {
    const balance = this.accountResource?.current()?.balance;

    return balance === undefined ? undefined : parseFloat((Number(balance) / 10 ** CERE_DECIMALS).toFixed(2));
  }

  get deposit() {
    // Try cluster-specific deposit first, then fall back to general deposit
    const clusterDeposit = this.clusterAccountResource?.current()?.deposit;
    const generalDeposit = this.accountResource?.current()?.deposit;

    const deposit = clusterDeposit !== undefined ? clusterDeposit : generalDeposit;

    return deposit === undefined ? undefined : parseFloat((Number(deposit) / 10 ** CERE_DECIMALS).toFixed(2));
  }

  get buckets() {
    // Prefer cluster-specific buckets if available
    const clusterBuckets = this.clusterAccountResource?.current()?.buckets;
    const allBuckets = this.accountResource?.current()?.buckets;

    const buckets = clusterBuckets && clusterBuckets.length > 0 ? clusterBuckets : allBuckets;

    return buckets?.map<Bucket>((bucket) => ({
      ...bucket,
      stats: this.getBucketStats(bucket.id),
    }));
  }

  // Add method to get cluster-specific deposit
  get clusterDeposit() {
    const deposit = this.clusterAccountResource?.current()?.deposit;
    return deposit === undefined ? undefined : parseFloat((Number(deposit) / 10 ** CERE_DECIMALS).toFixed(2));
  }

  // Add method to get all deposits (legacy and cluster-specific)
  get allDeposits() {
    const account = this.accountResource?.current();
    return account?.buckets || [];
  }

  get userInfo() {
    return this.userInfoPromise?.case({
      fulfilled: (userInfo) => userInfo,
    });
  }

  async connect({ email }: ConnectOptions) {
    /**
     * If the user is already connected - disconnect first
     */
    if (this.status === 'connected') {
      await this.disconnect();

      /**
       * Wait for the wallet to disconnect
       * TODO: Figure out a better way to handle this on Cere Wallet side
       */
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    await this.signer.connect({
      email,
      permissions: WALLET_PERMISSIONS,
    });

    const userInfo = await this.wallet.getUserInfo();

    if (userInfo.isNewUser && this.address) {
      Reporting.userSignedUp(this.address);
    }

    return userInfo;
  }

  async init() {
    if (this.wallet.status !== 'not-ready') {
      return this.status;
    }

    await this.wallet.init(WALLET_INIT_OPTIONS);

    return this.status;
  }

  async disconnect() {
    await this.wallet.disconnect();
  }

  async signMessage(message: string) {
    if (!this.address) {
      throw new Error('Account is not ready');
    }

    await this.signer.isReady();

    const signer = await this.signer.getSigner();
    const sigResult = await signer.signRaw?.({
      type: 'bytes',
      address: this.address,
      data: message,
    });

    return sigResult?.signature as string;
  }

  async createBucket(params: BucketParams) {
    await this.bcReadyPromise;

    try {
      const bucketId = await this.ddc.createBucket(DDC_CLUSTER_ID, params);
      console.log('Bucket created successfully with ID:', bucketId.toString());
      try {
        const bucketInfo = await this.ddc.getBucket(bucketId);
        console.log('Created bucket info:', bucketInfo);
      } catch (getBucketError) {
        console.warn('️Could not fetch bucket info immediately after creation:', getBucketError);
      }

      return bucketId;
    } catch (error) {
      console.error('Failed to create bucket:', error);
      throw error;
    }
  }

  async saveBucket(bucketId: bigint, params: BucketParams) {
    await this.bcReadyPromise;

    await this.blockchain.send(this.blockchain.ddcCustomers.setBucketParams(bucketId, params), {
      account: this.signer,
    });
  }

  async topUp(amount: number) {
    await this.bcReadyPromise;

    await this.ddc.depositBalance(DDC_CLUSTER_ID, BigInt(amount) * BigInt(10 ** CERE_DECIMALS));

    // Refresh both resources to get updated balances
    this.accountResource = undefined;
    this.accountResource = createAccountResource(this);
    this.clusterAccountResource = undefined;
    this.clusterAccountResource = createClusterAccountResource(this);

    if (this.address) {
      Reporting.topUp(this.address, amount);
    }
  }

  async createAuthToken(bucketId: bigint, pieceCid: string) {
    const params: AuthTokenParams = {
      subject: this.address!,
      bucketId,
      pieceCid,
      operations: [AuthTokenOperation.GET],
    };

    return new AuthToken(params).sign(this.signer);
  }
}
