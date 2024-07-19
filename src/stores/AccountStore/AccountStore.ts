import { makeAutoObservable, runInAction } from 'mobx';
import { fromPromise, IPromiseBasedObservable } from 'mobx-utils';

import { EmbedWallet, WalletStatus, UserInfo, WalletAccount, WalletBalance } from '@cere/embed-wallet';
import { DdcClient, CereWalletSigner, DEVNET } from '@cere-ddc-sdk/ddc-client';

import { APP_ENV, APP_ID } from '~/constants';
import { WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, AccountStatus, ConnectOptions } from './types';

export class AccountStore implements Account {
  private currentStatus: AccountStatus = 'not-ready';
  private currentAddress?: string;
  private currentBalance?: number;
  private currentSigner?: CereWalletSigner;

  private ddcPromise?: IPromiseBasedObservable<DdcClient>;
  private userInfoPromise?: IPromiseBasedObservable<UserInfo>;

  readonly wallet = new EmbedWallet({
    appId: APP_ID,
    env: APP_ENV,
  });

  constructor() {
    makeAutoObservable(this);

    this.wallet.subscribe('accounts-update', async ([, cereAccount]: WalletAccount[]) => {
      if (!cereAccount) {
        return this.cleanup();
      }

      if (this.currentAddress !== cereAccount.address) {
        return this.bootstrap(cereAccount.address);
      }
    });

    this.wallet.subscribe('status-update', (status: WalletStatus) =>
      runInAction(() => {
        this.currentStatus = status;
      }),
    );

    this.wallet.subscribe('balance-update', ({ amount, type, token }: WalletBalance) =>
      runInAction(() => {
        if (type === 'native' && token === 'CERE') {
          this.currentBalance = amount.toNumber();
        }
      }),
    );
  }

  private async bootstrap(address: string) {
    this.currentAddress = address;
    this.currentSigner = new CereWalletSigner(this.wallet);

    this.userInfoPromise = fromPromise(this.wallet.getUserInfo());
    this.ddcPromise = fromPromise(DdcClient.create(this.currentSigner, DEVNET));
  }

  private async cleanup() {
    this.userInfoPromise = undefined;
    this.currentAddress = undefined;
    this.currentSigner = undefined;
    this.ddcPromise = undefined;
    this.currentBalance = undefined;
  }

  isReady(): this is ReadyAccount {
    return !!this.address && !!this.userInfo;
  }

  get status() {
    return this.currentStatus;
  }

  get address() {
    return this.currentAddress;
  }

  get balance() {
    return this.currentBalance;
  }

  get userInfo() {
    return this.userInfoPromise?.case({
      fulfilled: (userInfo) => userInfo,
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
    this.cleanup();

    await this.wallet.disconnect();
  }

  async signMessage(message: string) {
    if (!this.currentSigner || !this.currentAddress) {
      throw new Error('Account is not ready');
    }

    await this.currentSigner.isReady();

    const signer = await this.currentSigner.getSigner();
    const sigResult = await signer.signRaw?.({
      type: 'bytes',
      address: this.currentAddress,
      data: message,
    });

    return sigResult?.signature as string;
  }
}
