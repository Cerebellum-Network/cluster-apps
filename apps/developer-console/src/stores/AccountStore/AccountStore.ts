import { makeAutoObservable, reaction, when } from 'mobx';
import { fromPromise, IPromiseBasedObservable, IResource, keepAlive } from 'mobx-utils';
import { EmbedWallet, UserInfo, WalletStatus, WalletEnvironment } from '@cere/embed-wallet';
import { AuthToken, AuthTokenOperation, CereWalletSigner, DdcClient, MAINNET } from '@cere-ddc-sdk/ddc-client';
import { Blockchain, BucketParams } from '@cere-ddc-sdk/blockchain';
import { BucketStats, IndexedAccount } from '@cluster-apps/api';
import Reporting from '@cluster-apps/reporting';

import { APP_ENV, APP_ID, CERE_DECIMALS, DDC_CLUSTER_ID, DDC_PRESET, DDC_SDK_LOG_LEVEL, APP_EMAIL, APP_NAME } from '~/constants';
import { WALLET_INIT_OPTIONS, WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, ConnectOptions, AccountMetrics, Bucket } from './types';
import {
  createAccountResource,
  createAccountMetricsResource,
  createAddressResource,
  createStatusResource,
  createBucketStatsResource,
} from './resources';
import { AuthTokenParams } from '@cere-ddc-sdk/ddc';

export class AccountStore implements Account {
  readonly blockchain = new Blockchain({ wsEndpoint: MAINNET.blockchain });
  readonly wallet = new EmbedWallet({ 
    appId: APP_ID, 
    env: 'prod' // Force production environment
  });
  readonly signer = new CereWalletSigner(this.wallet, { autoConnect: false });
  readonly ddc = new DdcClient(this.signer, { blockchain: this.blockchain, logLevel: DDC_SDK_LOG_LEVEL });

  private statusResource = createStatusResource(this);
  private addressResource = createAddressResource(this);
  private accountResource?: IResource<IndexedAccount | undefined>;
  private accountMetricsResource?: IResource<AccountMetrics | undefined>;
  private bucketStatsResource?: IResource<BucketStats[] | undefined>;
  private initPromise?: Promise<WalletStatus>;
  private bcReadyPromise = fromPromise(Promise.all([this.blockchain.isReady(), this.signer.isReady()]));

  constructor() {
    makeAutoObservable(this, {
      wallet: false,
      signer: false,
      ddc: false,
      blockchain: false,
    });

    keepAlive(this, 'status');
    keepAlive(this, 'address');
    keepAlive(this, 'account');
    keepAlive(this, 'accountMetrics');
    keepAlive(this, 'bucketStats');

    // Initialize resources when blockchain is ready
    this.bcReadyPromise.then(() => {
      // Set up reaction for account data
      reaction(
        () => this.address,
        async (address) => {
          if (address) {
            console.log('Setting up account resources for address:', address);
            this.accountResource = createAccountResource(this);
            this.accountMetricsResource = createAccountMetricsResource(this);
            
            // Force immediate fetch
            if (this.accountResource && this.accountMetricsResource) {
              await Promise.all([
                this.accountResource.current(),
                this.accountMetricsResource.current()
              ]);
            }
          } else {
            this.accountResource = undefined;
            this.accountMetricsResource = undefined;
          }
        },
        { fireImmediately: true }
      );

      // Set up reaction for bucket stats
      reaction(
        () => this.buckets,
        async (buckets) => {
          if (buckets?.length) {
            console.log('Setting up bucket stats for buckets:', buckets);
            this.bucketStatsResource = createBucketStatsResource(this);
            if (this.bucketStatsResource) {
              await this.bucketStatsResource.current();
            }
          } else {
            this.bucketStatsResource = undefined;
          }
        },
        { fireImmediately: true }
      );
    });
  }

  get status() {
    return this.statusResource.current();
  }

  get address() {
    return this.addressResource.current();
  }

  get account() {
    return this.accountResource?.current();
  }

  get balance() {
    const balance = this.accountResource?.current()?.balance;
    console.log('Raw balance from mainnet:', balance?.toString());
    return balance === undefined ? undefined : parseFloat((Number(balance) / 10 ** CERE_DECIMALS).toFixed(2));
  }

  get deposit() {
    const deposit = this.accountResource?.current()?.deposit;
    console.log('Raw deposit from mainnet:', deposit?.toString());
    return deposit === undefined ? undefined : parseFloat((Number(deposit) / 10 ** CERE_DECIMALS).toFixed(2));
  }

  get accountMetrics() {
    return this.accountMetricsResource?.current();
  }

  get bucketStats() {
    return this.bucketStatsResource?.current();
  }

  get buckets() {
    return this.account?.buckets || [];
  }

  isReady(): this is ReadyAccount {
    return this.bcReadyPromise.state === 'fulfilled' && !!this.address && !!this.account;
  }

  async init(): Promise<WalletStatus> {
    if (this.initPromise) {
      return this.initPromise;
    }

    console.log('Initializing AccountStore...');
    this.initPromise = (async () => {
      try {
        await this.wallet.init(WALLET_INIT_OPTIONS);
        await this.bcReadyPromise;
        console.log('AccountStore initialization complete');
        return this.wallet.status;
      } catch (error) {
        console.error('AccountStore initialization failed:', error);
        Reporting.message('AccountStore initialization failed', 'error', { error });
        throw error;
      }
    })();

    return this.initPromise;
  }

  async connect({ email }: ConnectOptions): Promise<UserInfo> {
    console.log('AccountStore: Starting connection process for email:', email);

    await this.init();
    console.log('AccountStore: Wallet is ready');

    if (this.status === 'connected') {
      await this.disconnect();
      // Wait for the wallet to disconnect
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('AccountStore: Signer is ready');
    console.log('AccountStore: Connecting signer with permissions:', WALLET_PERMISSIONS);

    await this.signer.connect({
      email,
      permissions: WALLET_PERMISSIONS,
    });

    // Wait for connection to be established
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('AccountStore: Getting user info...');
    const userInfo = await this.wallet.getUserInfo();
    console.log('AccountStore: User info received:', userInfo);

    if (!userInfo) {
      throw new Error('Failed to get user info after connection');
    }

    if (userInfo.isNewUser && this.address) {
      console.log('AccountStore: New user signed up with address:', this.address);
      Reporting.userSignedUp(this.address);
    }

    return userInfo;
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
    this.accountResource = undefined;
    this.accountResource = createAccountResource(this);

    if (this.address) {
      Reporting.topUp(this.address, amount);
    }
  }

  async createAuthToken(bucketId: bigint, pieceCid: string) {
    const params: Omit<AuthTokenParams, 'subject'> = {
      bucketId,
      pieceCid,
      operations: [AuthTokenOperation.GET],
    };

    return new AuthToken(params).sign(this.signer);
  }
}
