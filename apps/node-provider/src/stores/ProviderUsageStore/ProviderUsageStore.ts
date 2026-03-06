import { makeAutoObservable, runInAction } from 'mobx';
import {
  VdrServiceApi,
  ProviderEraRecord,
  ProviderMetricKey,
  ProviderTableRowData,
  EraRangePreset,
  ERA_RANGE_OFFSETS,
} from '@cluster-apps/api';
import { AccountStore } from '../AccountStore';

const RETRY_DELAYS = [1000, 2000, 4000];

export class ProviderUsageStore {
  private vdrApi = new VdrServiceApi();
  private retryCount = 0;
  private lastProviderId: string | null = null;
  private requestId = 0;

  eras: ProviderEraRecord[] = [];
  isLoading = false;
  error: string | null = null;
  selectedMetric: ProviderMetricKey = 'cpu_units';
  eraRangePreset: EraRangePreset = 'all_time';

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);
  }

  get chartData(): ProviderEraRecord[] {
    return [...this.eras].reverse();
  }

  get tableData(): ProviderTableRowData[] {
    return this.eras.map((era, index) => {
      const nextEra = this.eras[index + 1];
      let rewardDelta: number | null = null;

      if (nextEra) {
        const currentReward = parseFloat(era.reward);
        const previousReward = parseFloat(nextEra.reward);

        if (previousReward !== 0) {
          rewardDelta = ((currentReward - previousReward) / previousReward) * 100;
        }
      }

      return { ...era, rewardDelta };
    });
  }

  get isEmpty(): boolean {
    return !this.isLoading && this.eras.length === 0 && !this.error;
  }

  async fetchEras(providerId?: string) {
    const id = providerId ?? this.lastProviderId ?? this.accountStore.address;
    if (!id) return;

    this.lastProviderId = id;
    this.isLoading = true;
    this.error = null;

    const currentRequestId = ++this.requestId;

    const offset = ERA_RANGE_OFFSETS[this.eraRangePreset];
    const params = offset != null ? { timeFrom: Date.now() - offset, timeTo: Date.now() } : undefined;

    try {
      const result = await this.vdrApi.getProviderEras(id, params);
      runInAction(() => {
        if (currentRequestId !== this.requestId) return;
        this.eras = result;
        this.isLoading = false;
        this.retryCount = 0;
      });
    } catch (err) {
      runInAction(() => {
        if (currentRequestId !== this.requestId) return;
        if (this.retryCount < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[this.retryCount];
          this.retryCount++;
          setTimeout(() => this.fetchEras(id), delay);
        } else {
          this.error = err instanceof Error ? err.message : 'An unexpected error occurred.';
          this.isLoading = false;
          this.retryCount = 0;
        }
      });
    }
  }

  setMetric(key: ProviderMetricKey) {
    this.selectedMetric = key;
  }

  setEraRange(preset: EraRangePreset) {
    this.eraRangePreset = preset;
    this.fetchEras();
  }

  retry() {
    this.error = null;
    this.retryCount = 0;
    this.fetchEras();
  }

  reset() {
    this.eras = [];
    this.isLoading = false;
    this.error = null;
    this.selectedMetric = 'cpu_units';
    this.eraRangePreset = 'all_time';
    this.retryCount = 0;
    this.lastProviderId = null;
    this.requestId = 0;
  }
}
