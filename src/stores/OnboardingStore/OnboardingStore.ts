import { makeAutoObservable, when } from 'mobx';
import { fromPromise } from 'mobx-utils';
import { FaucetApi } from '@developer-console/api';
import { reportError } from '@developer-console/reporting';

import { ONBOARDIN_DEPOSIT_AMOUNT, ONBOARDIN_PUBLIC_BUCKET, ONBOARDIN_REWARD_AMOUNT } from '~/constants';
import { AccountStore } from '../AccountStore';

export type OnboardingStep = {
  key: 'wallet' | 'reward' | 'deposit' | 'bucket';
  readonly isCompleted: boolean;
};

export class OnboardingStore {
  private faucetApi = new FaucetApi();
  private currentSteps: OnboardingStep[] = [];

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);
  }

  get steps() {
    return this.currentSteps;
  }

  async addStep(key: OnboardingStep['key'], run: () => Promise<unknown>) {
    const runPromise = fromPromise(run());

    this.currentSteps = [
      ...this.currentSteps,
      {
        key,
        get isCompleted() {
          return runPromise.state === 'fulfilled';
        },
      },
    ];

    return runPromise;
  }

  /**
   * If the account has buckkets created or he is not a new user - we assume the account as inboarded
   */
  get isDone() {
    const { buckets, userInfo } = this.accountStore;

    const isOldUser = userInfo && !userInfo.isNewUser;
    const hasBuckets = buckets && buckets.length > 0;

    return isOldUser || hasBuckets;
  }

  async shouldOnboard() {
    await when(() => this.isDone !== undefined, {
      timeout: 30000,
      name: 'shouldOnboard',
      onError: (originalException) => reportError('Onboarding status is not defained after 30s', { originalException }),
    });

    return !this.isDone;
  }

  async startOnboarding() {
    this.reset();

    await this.addStep('wallet', () => when(() => this.accountStore.status === 'connected'));
    await this.addStep('reward', async () => {
      await this.faucetApi.sendTokens(this.accountStore.address!, ONBOARDIN_REWARD_AMOUNT);

      return when(() => !!this.accountStore.balance, {
        timeout: 30000,
        name: 'tokenTransfer',
        onError: (originalException) => reportError('Reward tokens are not received after 30s', { originalException }),
      });
    });

    await this.addStep('deposit', () => this.accountStore.topUp(ONBOARDIN_DEPOSIT_AMOUNT));
    await this.addStep('bucket', () => this.accountStore.createBucket({ isPublic: ONBOARDIN_PUBLIC_BUCKET }));
  }

  reset() {
    this.currentSteps = [];
  }
}
