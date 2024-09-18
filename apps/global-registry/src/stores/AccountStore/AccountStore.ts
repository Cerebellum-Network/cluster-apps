import { makeAutoObservable } from 'mobx';
import { keepAlive } from 'mobx-utils';
import { EmbedWallet } from '@cere/embed-wallet';
import { CereWalletSigner } from '@cere-ddc-sdk/ddc-client';

import { APP_ENV, APP_ID } from '~/constants';
import { WALLET_INIT_OPTIONS, WALLET_PERMISSIONS } from './walletConfig';
import { Account, ConnectOptions, ReadyAccount } from './types';
import { createAccountResource, createAddressResource, createStatusResource } from './resources';

export class AccountStore implements Account {
  readonly wallet = new EmbedWallet({ appId: APP_ID, env: APP_ENV });
  readonly signer = new CereWalletSigner(this.wallet, { autoConnect: false });

  private statusResource = createStatusResource(this);
  private addressResource = createAddressResource(this);
  private accountResource = createAccountResource(this);

  constructor() {
    makeAutoObservable(this, {
      wallet: false,
      signer: false,
    });

    keepAlive(this, 'status');
    keepAlive(this, 'address');
  }

  get status() {
    return this.statusResource.current();
  }

  get address() {
    return this.addressResource.current();
  }

  get account() {
    return this.accountResource.current();
  }

  get buckets() {
    return this.account?.buckets || [];
  }

  isReady(): this is ReadyAccount {
    return !!this.account;
  }

  async connect({ email }: ConnectOptions) {
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
}
