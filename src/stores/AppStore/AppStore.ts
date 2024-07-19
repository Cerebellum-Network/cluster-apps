import { makeAutoObservable } from 'mobx';

import { AccountStore } from '../AccountStore';

export type AppState = 'initing' | 'ready';

export class AppStore {
  readonly accountStore: AccountStore;

  constructor() {
    makeAutoObservable(this);

    this.accountStore = new AccountStore();
  }

  async init() {
    await this.accountStore.init();
  }
}
