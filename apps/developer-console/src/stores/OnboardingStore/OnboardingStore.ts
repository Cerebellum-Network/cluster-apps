import { makeAutoObservable, when, reaction } from 'mobx';
import { fromPromise } from 'mobx-utils';
import { FaucetApi, BillingApi } from '@cluster-apps/api';
import Reporting from '@cluster-apps/reporting';

import { AccountStore } from '../AccountStore';
import {
  FEATURE_USER_ONBOARDING,
  ONBOARDIN_DEPOSIT_AMOUNT,
  ONBOARDIN_PUBLIC_BUCKET,
  ONBOARDIN_REWARD_AMOUNT,
  BILLING_SERVICE_ENDPOINT,
} from '~/constants';

export type OnboardingStep = {
  key: 'wallet' | 'reward' | 'deposit' | 'bucket';
  readonly isCompleted: boolean;
};

export class OnboardingStore {
  private faucetApi = new FaucetApi();
  private billingApi: BillingApi;
  private currentSteps: OnboardingStep[] = [];
  private hasCalledBillingService = false; // Track if we've already called billing service

  constructor(private accountStore: AccountStore) {
    // Create billing API with explicit endpoint for debugging
    this.billingApi = new BillingApi(BILLING_SERVICE_ENDPOINT);
    
    makeAutoObservable(this);
    
    // Automatically call billing service when both email and wallet are available
    reaction(
      () => ({
        email: this.accountStore.userInfo?.email,
        walletAddress: this.accountStore.address
      }),
      async (data) => {
        if (data.email && data.walletAddress) {
          await this.callBillingServiceIfReady();
        }
      },
      { fireImmediately: true } // Check immediately on construction
    );
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
   * Call billing service when we have both email and wallet address
   */
  private async callBillingServiceIfReady() {
    // Only call once
    if (this.hasCalledBillingService) {
      return;
    }

    const userEmail = this.accountStore.userInfo?.email;
    const walletAddress = this.accountStore.address;
    
    if (userEmail && walletAddress && !this.hasCalledBillingService) {
      console.log('🔗 Calling billing service:', `${BILLING_SERVICE_ENDPOINT}/api/register-account`);
      
      try {
        await this.billingApi.registerAccount({
          accountId: walletAddress,
          email: userEmail,
        });
        
        console.log('✅ Billing service call successful!');
        this.hasCalledBillingService = true;
        Reporting.message('User data sent to billing service', 'info', { event: 'billingServiceSuccess' });
      } catch (error) {
        console.error('❌ Billing service call failed:', error);
        console.warn('Failed to send user data to billing service:', error);
        Reporting.message('Failed to send user data to billing service', 'warning', { 
          event: 'billingServiceError',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        // Don't fail the process if billing service fails
      }
    }
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

  /**
   * Check if we have enough data to determine onboarding status
   */
  get canDetermineStatus() {
    const { buckets, userInfo } = this.accountStore;
    return buckets !== undefined && userInfo !== undefined;
  }

  async processStatus() {
    await when(() => this.canDetermineStatus, { timeout: 30000 }).catch(() => {
      Reporting.message('Onboarding status is not properly detected after 30s', 'warning', {
        buckets: this.accountStore.buckets !== undefined ? 'loaded' : 'undefined',
        userInfo: this.accountStore.userInfo !== undefined ? 'loaded' : 'undefined',
      });
    });

    const result = !this.isDone;

    return result;
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

    // Send user data to billing service after successful onboarding
    await this.callBillingServiceIfReady();

    Reporting.message('User finished onboarding', 'info', { event: 'onboardingFinish' });
  }

  reset() {
    this.currentSteps = [];
    this.hasCalledBillingService = false; // Reset billing service call tracker on reset
  }

  /**
   * Test billing service connectivity
   */
  async testBillingService() {
    try {
      const isHealthy = await this.billingApi.healthCheck();
      if (isHealthy) {
      } else {
      }
    } catch (error) {
    }
  }

  /**
   * Manually test billing service registration (for debugging)
   */
  async testBillingServiceRegistration() {
    console.log('🧪 Manually testing billing service registration...');
    
    // Mock data for testing
    const testData = {
      accountId: '0x1234567890abcdef1234567890abcdef12345678',
      email: 'test@example.com'
    };
    
    console.log('📤 Sending test data:', testData);
    console.log('🔗 Endpoint:', `${BILLING_SERVICE_ENDPOINT}/api/register-account`);
    
    try {
      const result = await this.billingApi.registerAccount(testData);
      console.log('✅ Test registration successful:', result);
    } catch (error) {
      console.error('❌ Test registration failed:', error);
    }
  }

  /**
   * Manually trigger billing service call with current user data
   */
  async triggerBillingServiceCall() {
    console.log('🚀 Manually triggering billing service call...');
    await this.callBillingServiceIfReady();
  }

  /**
   * Test the billing service request format
   */
  async testBillingServiceFormat() {
    console.log('🧪 Testing billing service request format...');
    console.log('📋 This will show the data transformation from camelCase to snake_case');
    await this.billingApi.testRequestFormat();
  }
}
