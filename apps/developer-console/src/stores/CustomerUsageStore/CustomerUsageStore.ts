import { makeAutoObservable, runInAction } from 'mobx';
import {
  VdrServiceApi,
  CustomerEraRecord,
  MetricKey,
  EraRangePreset,
  TableRowData,
  ERA_RANGE_OFFSETS,
} from '@cluster-apps/api';
import { AccountStore } from '../AccountStore';

const RETRY_DELAYS = [1000, 2000, 4000];

export class CustomerUsageStore {
  private vdrApi = new VdrServiceApi();
  private retryCount = 0;
  private lastCustomerId: string | null = null;

  eras: CustomerEraRecord[] = [];
  isLoading = false;
  error: string | null = null;
  selectedMetric: MetricKey = 'cpu_units';
  eraRangePreset: EraRangePreset = 'all_time';

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);
  }

  get chartData(): CustomerEraRecord[] {
    return [...this.eras].reverse();
  }

  get tableData(): TableRowData[] {
    return this.eras.map((era, index) => {
      const nextEra = this.eras[index + 1];
      let usageDelta: number | null = null;

      if (nextEra) {
        const currentCharge = parseFloat(era.charge);
        const previousCharge = parseFloat(nextEra.charge);

        if (previousCharge !== 0) {
          usageDelta = ((currentCharge - previousCharge) / previousCharge) * 100;
        }
      }

      return { ...era, usageDelta };
    });
  }

  get isEmpty(): boolean {
    return !this.isLoading && this.eras.length === 0 && !this.error;
  }

  async fetchEras(customerId?: string) {
    const id = customerId ?? this.lastCustomerId ?? this.accountStore.address;
    if (!id) return;

    this.lastCustomerId = id;
    this.isLoading = true;
    this.error = null;

    const offset = ERA_RANGE_OFFSETS[this.eraRangePreset];
    const params = offset != null ? { timeFrom: Date.now() - offset, timeTo: Date.now() } : undefined;

    try {
      const result = await this.vdrApi.getCustomerEras(id, params);
      runInAction(() => {
        this.eras = result;
        this.isLoading = false;
        this.retryCount = 0;
      });
    } catch (err) {
      runInAction(() => {
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

  setMetric(key: MetricKey) {
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
    this.lastCustomerId = null;
  }
}
