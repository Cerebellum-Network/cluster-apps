import { makeAutoObservable, runInAction } from 'mobx';

import { AccountStore } from '../AccountStore';
import { OnboardingStore } from '../OnboardingStore/OnboardingStore';

export type AppState = 'initing' | 'onboard' | 'ready';

export class AppStore {
  private isInited = false;

  readonly accountStore: AccountStore;
  readonly onboardingStore: OnboardingStore;

  constructor() {
    makeAutoObservable(this);

    this.accountStore = new AccountStore();
    this.onboardingStore = new OnboardingStore(this.accountStore);
  }

  get isReady() {
    return this.isInited;
  }

  async init() {
    await this.accountStore.init();

    runInAction(() => {
      this.isInited = true;
    });
  }
}
