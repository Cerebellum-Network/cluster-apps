import { makeAutoObservable, when } from 'mobx';
import { fromPromise } from 'mobx-utils';
import { FaucetApi } from '@cluster-apps/api';
import Reporting from '@cluster-apps/reporting';

import { AccountStore } from '../AccountStore';
import {
  FEATURE_USER_ONBOARDING,
  ONBOARDIN_DEPOSIT_AMOUNT,
  ONBOARDIN_PUBLIC_BUCKET,
  ONBOARDIN_REWARD_AMOUNT,
} from '~/constants';

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

  async processStatus() {
    await when(() => this.isDone !== undefined, { timeout: 30000 }).catch(() => {
      Reporting.message('Onboarding status is not properly detected after 30s', 'warning');
    });

    return !this.isDone;
  }

  async shouldSendToMarketingTool() {
    return this.processStatus();
  }

  async shouldOnboard() {
    if (!FEATURE_USER_ONBOARDING) {
      return false;
    }

    return this.processStatus();
  }

  async startOnboarding() {
    Reporting.message('User started onboarding', 'info', { event: 'onboardingStart' });

    this.reset();

    await this.addStep('wallet', () => when(() => !!this.accountStore.address));
    await this.addStep('reward', async () => {
      await this.faucetApi.sendTokens(this.accountStore.address!, ONBOARDIN_REWARD_AMOUNT);

      return when(() => !!this.accountStore.balance, { timeout: 60000 }).catch(() => {
        throw new Error('Onboarding tokens were not received after 60s');
      });
    });

    await this.addStep('deposit', () => this.accountStore.topUp(ONBOARDIN_DEPOSIT_AMOUNT));
    await this.addStep('bucket', () => this.accountStore.createBucket({ isPublic: ONBOARDIN_PUBLIC_BUCKET }));

    Reporting.message('User finished onboarding', 'info', { event: 'onboardingFinish' });
  }

  reset() {
    this.currentSteps = [];
  }
}
