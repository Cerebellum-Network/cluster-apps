import { makeAutoObservable, runInAction } from 'mobx';
import { EmbedWallet, WalletStatus, UserInfo, WalletAccount, WalletBalance } from '@cere/embed-wallet';
import { DdcClient, CereWalletSigner, DEVNET } from '@cere-ddc-sdk/ddc-client';

import { APP_ENV, APP_ID } from '~/constants';
import { WALLET_PERMISSIONS } from './walletConfig';
import { Account, ReadyAccount, AccountStatus, ConnectOptions } from './types';

export class AccountStore implements Account {
  private currentStatus: AccountStatus = 'not-ready';
  private currentUserInfo?: UserInfo;
  private currentAddress?: string;
  private currentBalance?: number;
  private currentDdc?: DdcClient;
  private currentSigner?: CereWalletSigner;

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
    const signer = new CereWalletSigner(this.wallet);
    const [userInfo, ddc] = await Promise.all([this.wallet.getUserInfo(), DdcClient.create(signer, DEVNET)]);

    runInAction(() => {
      this.currentAddress = address;
      this.currentUserInfo = userInfo;
      this.currentSigner = signer;
      this.currentDdc = ddc;
    });
  }

  private async cleanup() {
    this.currentUserInfo = undefined;
    this.currentAddress = undefined;
    this.currentSigner = undefined;
    this.currentDdc = undefined;
    this.currentBalance = undefined;
  }

  isReady(): this is ReadyAccount {
    return !!this.userInfo && !!this.ddc;
  }

  get ddc() {
    return this.currentDdc;
  }

  get status() {
    return this.currentStatus;
  }

  get userInfo() {
    return this.currentUserInfo;
  }

  get address() {
    return this.currentAddress;
  }

  get balance() {
    return this.currentBalance;
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
