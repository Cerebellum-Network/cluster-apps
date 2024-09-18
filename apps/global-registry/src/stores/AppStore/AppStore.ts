import { makeAutoObservable, runInAction } from 'mobx';

import { AccountStore } from '../AccountStore';

export class AppStore {
  private isInited = false;

  readonly accountStore: AccountStore;

  constructor() {
    makeAutoObservable(this);

    this.accountStore = new AccountStore();
  }

  get isReady() {
    return this.isInited;
  }

  async init() {
    await this.accountStore.init();

    runInAction(() => {
      this.isInited = true;
    });

    return this.accountStore.isReady();
  }
}
