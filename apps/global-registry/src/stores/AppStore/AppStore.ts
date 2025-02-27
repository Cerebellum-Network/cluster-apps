import { makeAutoObservable, runInAction } from 'mobx';

import { AccountStore } from '../AccountStore';
import { RegistryStore } from '../RegistryStore';

export class AppStore {
  private isInited = false;

  readonly accountStore: AccountStore;
  readonly registryStore: RegistryStore;

  constructor() {
    makeAutoObservable(this);

    this.accountStore = new AccountStore();
    this.registryStore = new RegistryStore(this.accountStore);
  }

  get isReady() {
    if (this.accountStore.status === 'connected') {
      return this.accountStore.isReady();
    }

    return this.isInited;
  }

  async init() {
    await this.accountStore.init();

    runInAction(() => {
      this.isInited = true;
    });
  }
}
