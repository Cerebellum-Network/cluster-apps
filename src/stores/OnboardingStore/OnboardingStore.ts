import { autorun, makeAutoObservable } from 'mobx';
import { FaucetApi } from '@developer-console/api';

import { AccountStore } from '../AccountStore';

export type OnboardingStep = {
  key: 'wallet' | 'reward' | 'deposit' | 'bucket';
  isCompleted: boolean;
};

export class OnboardingStore {
  private faucetApi = new FaucetApi();

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    autorun(() => {
      console.log('Onboarding', 'Wallet connnected', this.accountStore.status === 'connected');
      console.log('Onboarding', 'Buckets', this.accountStore.buckets?.length);
      console.log('Onboarding', 'Balance', this.accountStore.balance);
      console.log('Onboarding', 'Deposit', this.accountStore.deposit);
    });
  }

  get steps(): OnboardingStep[] {
    const isConnected = this.accountStore.status === 'connected';
    const deposit = this.accountStore.deposit ?? 0;
    const hasBuckets = !!this.accountStore.buckets?.length;
    const balance = this.accountStore.balance ?? 0;

    return [
      {
        key: 'wallet',
        isCompleted: isConnected,
      },
      {
        key: 'reward',
        isCompleted: balance > 0,
      },
      {
        key: 'deposit',
        isCompleted: deposit > 0,
      },
      {
        key: 'bucket',
        isCompleted: hasBuckets,
      },
    ];
  }

  get isDone() {
    return this.steps.every((step) => step.isCompleted);
  }

  async startOnboarding() {
    await this.faucetApi.sendTokens(this.accountStore.address!, 50);
    await this.accountStore.topUp(40);
    await this.accountStore.createBucket();
  }
}
