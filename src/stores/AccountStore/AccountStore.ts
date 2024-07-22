import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { fromPromise, IPromiseBasedObservable, IResource, keepAlive } from 'mobx-utils';
import { EmbedWallet, UserInfo } from '@cere/embed-wallet';
import { CereWalletSigner, DdcClient } from '@cere-ddc-sdk/ddc-client';
import { IndexedBucket } from '@developer-console/api';

import { APP_ENV, APP_ID, CERE_DECIMALS, DDC_CLUSTER_ID, DDC_PRESET } from '~/constants';
import { WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, ConnectOptions } from './types';
import {
  createAddressResource,
  createBalanceResource,
  createBucketsResource,
  createDepositResource,
  createStatusResource,
} from './resources';

export class AccountStore implements Account {
  readonly wallet = new EmbedWallet({ appId: APP_ID, env: APP_ENV });

  private statusResource = createStatusResource(this);
  private addressResource = createAddressResource(this);

  private balanceResource?: IResource<number | undefined>;
  private depositResource?: IResource<number | undefined>;
  private bucketsResource?: IResource<IndexedBucket[] | undefined>;

  private userInfoPromise?: IPromiseBasedObservable<UserInfo>;
  private signerPromise?: IPromiseBasedObservable<CereWalletSigner>;
  private ddcPromise?: IPromiseBasedObservable<DdcClient>;

  constructor() {
    makeAutoObservable(this);

    keepAlive(this, 'status');
    keepAlive(this, 'address');

    reaction(
      () => this.address && this.status === 'connected',
      (isConnected) => (isConnected ? this.bootstrap() : this.cleanup()),
    );
  }

  private async bootstrap() {
    const signer = new CereWalletSigner(this.wallet);

    this.userInfoPromise = fromPromise(this.wallet.getUserInfo());
    this.depositResource = createDepositResource(this);
    this.bucketsResource = createBucketsResource(this);

    this.ddcPromise = fromPromise(DdcClient.create(signer, DDC_PRESET));
    this.signerPromise = fromPromise(signer.isReady().then(() => signer));

    this.signerPromise.then(() =>
      runInAction(() => {
        this.balanceResource = createBalanceResource(this);
        this.depositResource = createDepositResource(this);
      }),
    );
  }

  private async cleanup() {
    this.userInfoPromise = undefined;
    this.ddcPromise = undefined;
    this.balanceResource = undefined;
    this.depositResource = undefined;
    this.signerPromise = undefined;
    this.bucketsResource = undefined;
  }

  isReady(): this is ReadyAccount {
    return !!this.address && !!this.userInfo;
  }

  get status() {
    return this.statusResource.current();
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
    return this.bucketsResource?.current();
  }

  get userInfo() {
    return this.userInfoPromise?.case({
      fulfilled: (userInfo) => userInfo,
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
    await this.wallet.connect({
      email,
      permissions: WALLET_PERMISSIONS,
    });
  }

  async init() {
    await this.wallet.init();

    return this.status;
  }

  async disconnect() {
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

  async createBucket(isPublic = true) {
    if (!this.ddc) {
      throw new Error('DDC is not ready');
    }

    return this.ddc.createBucket(DDC_CLUSTER_ID, {
      isPublic,
    });
  }

  async topUp(amount: number) {
    if (!this.ddc) {
      throw new Error('DDC is not ready');
    }

    return this.ddc.depositBalance(BigInt(amount) * BigInt(10 ** CERE_DECIMALS));
  }
}
