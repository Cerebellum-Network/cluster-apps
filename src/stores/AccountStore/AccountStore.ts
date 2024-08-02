import { makeAutoObservable, reaction, when } from 'mobx';
import { fromPromise, IPromiseBasedObservable, IResource, keepAlive } from 'mobx-utils';
import { EmbedWallet, UserInfo } from '@cere/embed-wallet';
import { CereWalletSigner, DdcClient } from '@cere-ddc-sdk/ddc-client';
import { Blockchain, BucketParams } from '@cere-ddc-sdk/blockchain';
import { BucketStats, IndexedAccount, StatsApi } from '@developer-console/api';
import Reporting from '@developer-console/reporting';

import { APP_ENV, APP_ID, CERE_DECIMALS, DDC_CLUSTER_ID, DDC_PRESET } from '~/constants';
import { WALLET_INIT_OPTIONS, WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, ConnectOptions, Bucket } from './types';
import { createAccountResource, createAddressResource, createStatusResource } from './resources';

export class AccountStore implements Account {
  readonly blockchain = new Blockchain({ wsEndpoint: DDC_PRESET.blockchain });
  readonly wallet = new EmbedWallet({ appId: APP_ID, env: APP_ENV });
  readonly signer = new CereWalletSigner(this.wallet, { autoConnect: false });
  readonly ddc = new DdcClient(this.signer, { blockchain: this.blockchain });

  private bcReadyPromise = fromPromise(Promise.all([this.blockchain.isReady(), this.signer.isReady()]));
  private statusResource = createStatusResource(this);
  private addressResource = createAddressResource(this);
  private accountResource?: IResource<IndexedAccount | undefined>;
  private userInfoPromise?: IPromiseBasedObservable<UserInfo>;
  private bucketStatsPromise?: IPromiseBasedObservable<BucketStats[]>;

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

    /**
     * Track user changes and update the user in the reporting
     */
    reaction(
      () => this.userInfo,
      (userInfo) => {
        if (!userInfo) {
          return Reporting.clearUser();
        }

        Reporting.setUser({ id: this.address!, email: userInfo.email, username: userInfo.name });

        if (userInfo.isNewUser) {
          Reporting.userSignedUp(this.address!);
        }
      },
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
    this.userInfoPromise = fromPromise(this.wallet.getUserInfo());
  }

  private async cleanup() {
    this.userInfoPromise = undefined;
    this.accountResource = undefined;
  }

  private getBucketStats(bucketId: bigint) {
    return this.bucketStatsPromise?.case({
      fulfilled: (stats) => stats.find((stat) => stat.bucketId === bucketId),
    });
  }

  isReady(): this is ReadyAccount {
    return !!this.userInfo && !!this.buckets;
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
    const balance = this.accountResource?.current()?.balance;

    return !balance ? undefined : Number(balance / BigInt(10 ** CERE_DECIMALS));
  }

  get deposit() {
    const deposit = this.accountResource?.current()?.deposit;

    return !deposit ? undefined : Number(deposit / BigInt(10 ** CERE_DECIMALS));
  }

  get buckets() {
    return this.accountResource?.current()?.buckets.map<Bucket>((bucket) => ({
      ...bucket,
      stats: this.getBucketStats(bucket.id),
    }));
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
  }

  async init() {
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

    return this.ddc.createBucket(DDC_CLUSTER_ID, params).then((bucketId) => {
      Reporting.bucketCreated(bucketId);

      return bucketId;
    });
  }

  async saveBucket(bucketId: bigint, params: BucketParams) {
    await this.bcReadyPromise;

    await this.blockchain.send(this.blockchain.ddcCustomers.setBucketParams(bucketId, params), {
      account: this.signer,
    });
  }

  async topUp(amount: number) {
    await this.bcReadyPromise;

    await this.ddc.depositBalance(BigInt(amount) * BigInt(10 ** CERE_DECIMALS));
  }
}
