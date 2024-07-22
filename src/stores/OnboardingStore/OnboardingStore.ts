import { autorun, makeAutoObservable, when } from 'mobx';
import { FaucetApi } from '@developer-console/api';

import { AccountStore } from '../AccountStore';
import { fromPromise } from 'mobx-utils';

export type OnboardingStep = {
  key: 'wallet' | 'reward' | 'deposit' | 'bucket';
  readonly isCompleted: boolean;
};

export class OnboardingStore {
  private faucetApi = new FaucetApi();
  private currentSteps: OnboardingStep[] = [];

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    autorun(() => {
      console.log('Onboarding', 'Wallet connnected', this.accountStore.status === 'connected');
      console.log('Onboarding', 'Buckets', this.accountStore.buckets?.length);
      console.log('Onboarding', 'Balance', this.accountStore.balance);
      console.log('Onboarding', 'Deposit', this.accountStore.deposit);
    });
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
   * If the account has buckkets created we assume the account as inboarded
   */
  get isDone() {
    return !!this.accountStore.buckets?.length;
  }

  async startOnboarding() {
    await this.addStep('wallet', () => when(() => this.accountStore.status === 'connected'));
    await this.addStep('reward', async () => {
      await this.faucetApi.sendTokens(this.accountStore.address!, 50);

      return when(() => !!this.accountStore.balance);
    });

    await this.addStep('deposit', () => this.accountStore.topUp(40));
    await this.addStep('bucket', () => this.accountStore.createBucket());
  }
}
