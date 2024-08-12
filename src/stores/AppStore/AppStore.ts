import { makeAutoObservable, runInAction } from 'mobx';

import { AccountStore } from '../AccountStore';
import { OnboardingStore } from '../OnboardingStore/OnboardingStore';
import { QuestsStore } from '../QuestsStore';
import { ContentStorageStore } from '../ContentStorageStore';

export type AppState = 'initing' | 'onboard' | 'ready';

export class AppStore {
  private isInited = false;

  readonly accountStore: AccountStore;
  readonly onboardingStore: OnboardingStore;
  readonly questsStore: QuestsStore;
  readonly contentStorageStore: ContentStorageStore;

  constructor() {
    makeAutoObservable(this);

    this.accountStore = new AccountStore();
    this.onboardingStore = new OnboardingStore(this.accountStore);
    this.questsStore = new QuestsStore(this.accountStore);
    this.contentStorageStore = new ContentStorageStore(this.accountStore, this.questsStore);
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
