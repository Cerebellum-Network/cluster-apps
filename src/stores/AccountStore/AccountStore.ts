import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { fromPromise, IPromiseBasedObservable, IResource, keepAlive } from 'mobx-utils';
import { EmbedWallet, UserInfo } from '@cere/embed-wallet';
import { CereWalletSigner, DdcClient } from '@cere-ddc-sdk/ddc-client';
import { Blockchain, BucketParams } from '@cere-ddc-sdk/blockchain';
import { BucketStats, IndexedBucket, StatsApi } from '@developer-console/api';

import { APP_ENV, APP_ID, CERE_DECIMALS, DDC_CLUSTER_ID, DDC_PRESET } from '~/constants';
import { WALLET_INIT_OPTIONS, WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, ConnectOptions, Bucket } from './types';
import {
  createAddressResource,
  createBalanceResource,
  createBucketsResource,
  createDepositResource,
  createStatusResource,
} from './resources';
import { bucketCreated, clearUser, setUser, userSignedUp } from '@developer-console/reporting';

export class AccountStore implements Account {
  private isBootstrapped = false;

  readonly blockchain = new Blockchain({ wsEndpoint: DDC_PRESET.blockchain });
  readonly wallet = new EmbedWallet({ appId: APP_ID, env: APP_ENV });

  private statusResource = createStatusResource(this);
  private addressResource = createAddressResource(this);

  private balanceResource?: IResource<number | undefined>;
  private depositResource?: IResource<number | undefined>;
  private bucketsResource?: IResource<IndexedBucket[] | undefined>;

  private userInfoPromise?: IPromiseBasedObservable<UserInfo>;
  private signerPromise?: IPromiseBasedObservable<CereWalletSigner>;
  private bucketStatsPromise?: IPromiseBasedObservable<BucketStats[]>;
  private ddcPromise?: IPromiseBasedObservable<DdcClient>;

  private statsApi = new StatsApi();

  constructor() {
    makeAutoObservable(this, {
      wallet: false,
      blockchain: false,
    });

    keepAlive(this, 'status');
    keepAlive(this, 'address');

    reaction(
      () => this.address && this.status === 'connected',
      (isConnected) => (isConnected ? this.bootstrap() : this.cleanup()),
    );

    reaction(
      () => this.buckets?.length,
      () => {
        const ids = this.buckets?.map(({ id }) => id);

        this.bucketStatsPromise = ids ? fromPromise(this.statsApi.getBucketsStats(ids)) : undefined;
      },
    );
  }

  private async bootstrap() {
    const signer = new CereWalletSigner(this.wallet);

    this.bucketsResource = createBucketsResource(this);
    this.userInfoPromise = fromPromise(this.wallet.getUserInfo());
    this.ddcPromise = fromPromise(DdcClient.create(signer, { blockchain: this.blockchain }));
    this.signerPromise = fromPromise(signer.isReady().then(() => signer));

    await Promise.all([this.blockchain.isReady(), this.signerPromise, this.ddcPromise]);

    runInAction(() => {
      this.isBootstrapped = true;
      this.balanceResource = createBalanceResource(this);
      this.depositResource = createDepositResource(this);
    });
  }

  private async cleanup() {
    this.isBootstrapped = false;

    this.userInfoPromise = undefined;
    this.ddcPromise = undefined;
    this.balanceResource = undefined;
    this.depositResource = undefined;
    this.signerPromise = undefined;
    this.bucketsResource = undefined;
  }

  private getBucketStats(bucketId: bigint) {
    return this.bucketStatsPromise?.case({
      fulfilled: (stats) => stats.find((stat) => stat.bucketId === bucketId),
    });
  }

  isReady(): this is ReadyAccount {
    return this.isBootstrapped && !!this.userInfo && !!this.buckets && !!this.ddc && !!this.signer;
  }

  get status() {
    return this.statusResource.current();
  }

  /**
   * TODO: Figure out how to get the aggregated stats
   */
  get metrics() {
    const defaultStats: Omit<BucketStats, 'bucketId'> = {
      gets: 0,
      puts: 0,
      storedBytes: 0,
      transferredBytes: 0,
    };

    return (
      this.bucketStatsPromise?.case({
        fulfilled: (stats) =>
          stats.reduce((acc, { storedBytes, transferredBytes, gets, puts }) => {
            acc.storedBytes += storedBytes;
            acc.transferredBytes += transferredBytes;
            acc.gets += gets;
            acc.puts += puts;

            return acc;
          }, defaultStats),
      }) || defaultStats
    );
  }

  get address() {
    return this.addressResource.current();
  }

  get balance() {
    return this.balanceResource?.current();
  }

  get deposit() {
    return this.depositResource?.current();
  }

  get buckets() {
    return this.bucketsResource?.current()?.map<Bucket>((bucket) => ({
      ...bucket,
      stats: this.getBucketStats(bucket.id),
    }));
  }

  get userInfo() {
    return this.userInfoPromise?.case({
      fulfilled: (userInfo) => {
        if (userInfo.isNewUser) {
          userSignedUp(this.address!);
        }
        setUser({ id: this.address!, email: userInfo.email });
        return userInfo;
      },
    });
  }

  get signer() {
    return this.signerPromise?.case({
      fulfilled: (signer) => signer,
    });
  }

  get ddc() {
    return this.ddcPromise?.case({
      fulfilled: (ddc) => ddc,
    });
  }

  async connect({ email }: ConnectOptions) {
    /**
     * If the user is already connected - disconnect first
     */
    if (this.status === 'connected') {
      await this.disconnect();
    }

    await this.wallet.connect({
      email,
      permissions: WALLET_PERMISSIONS,
    });
  }

  async init() {
    await this.wallet.init(WALLET_INIT_OPTIONS);

    /**
     * Starts the blockchain connection here to lower the latency of the first request.
     */
    this.blockchain.isReady();

    return this.status;
  }

  async disconnect() {
    clearUser();
    await this.wallet.disconnect();
  }

  async signMessage(message: string) {
    if (!this.signer || !this.address) {
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
    if (!this.ddc) {
      throw new Error('DDC is not ready');
    }

    const createdBucket = await this.ddc.createBucket(DDC_CLUSTER_ID, params);
    bucketCreated(createdBucket.toString());
    return createdBucket;
  }

  async saveBucket(bucketId: bigint, params: BucketParams) {
    if (!this.signer) {
      throw new Error('Account is not ready');
    }

    const tx = this.blockchain.ddcCustomers.setBucketParams(bucketId, params);
    await this.blockchain.send(tx, { account: this.signer });
  }

  async topUp(amount: number) {
    if (!this.ddc) {
      throw new Error('DDC is not ready');
    }

    return this.ddc.depositBalance(BigInt(amount) * BigInt(10 ** CERE_DECIMALS));
  }

  /**
   * TODO: Figure out a genreic way of updating resources
   */
  async refreshBuckets() {
    if (!this.ddc || !this.address) {
      throw new Error('DDC is not ready');
    }

    this.bucketsResource = createBucketsResource(this);
  }
}
