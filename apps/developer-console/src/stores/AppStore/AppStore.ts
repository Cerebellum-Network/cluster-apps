import { makeAutoObservable, reaction, runInAction } from 'mobx';

import { AccountStore } from '../AccountStore';
import { OnboardingStore } from '../OnboardingStore/OnboardingStore';
import { QuestsStore } from '../QuestsStore';
import { EventsStore } from '../EventsStore';

export type AppState = 'initing' | 'onboard' | 'ready';

export class AppStore {
  private isInited = false;

  readonly accountStore: AccountStore;
  readonly onboardingStore: OnboardingStore;
  readonly questsStore: QuestsStore;
  readonly eventsStore: EventsStore;

  constructor() {
    makeAutoObservable(this);

    this.accountStore = new AccountStore();
    this.onboardingStore = new OnboardingStore(this.accountStore);
    this.questsStore = new QuestsStore(this.accountStore);
    this.eventsStore = new EventsStore();
    reaction(
      () => this.accountStore.address,
      async (status) => {
        const connected = status === 'connected';

        runInAction(() => {
          this.isInited = connected;
        });

        if (connected) {
          await this.eventsStore.connect(this.accountStore.wallet);
        } else {
          this.eventsStore.disconnect();
        }
      },
    );
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
