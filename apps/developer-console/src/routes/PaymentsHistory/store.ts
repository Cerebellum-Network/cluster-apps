import { makeAutoObservable, runInAction } from 'mobx';
import { DacApi, EraDetail } from '@cluster-apps/api';
import { DDC_CLUSTER_ID } from '~/constants.ts';

export class PaymentsHistoryStore {
  private dacApi = new DacApi();
  private readonly clusterId: string = DDC_CLUSTER_ID;

  eras: number[] = [];
  selectedEraId: number | null = null;
  eraData: EraDetail[] = [];
  isLoading: boolean = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.fetchClusters();
  }

  async fetchClusters() {
    this.isLoading = true;
    this.error = null;

    try {
      const eras = await this.dacApi.getEras(this.clusterId);

      runInAction(() => {
        this.eras = eras;

        // Select first cluster by default if available
        if (eras.length > 0 && !this.selectedEraId) {
          this.selectedEraId = eras[0];
          this.fetchEraData(this.clusterId);
        }
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to fetch clusters';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async fetchEraData(clusterId: string) {
    if (!clusterId) return;

    this.isLoading = true;
    this.error = null;

    try {
      const eraData = await this.dacApi.getAllErasDetails(this.clusterId);

      runInAction(() => {
        this.eraData = eraData;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to fetch era details';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  setSelectedEra(eraId: number) {
    this.selectedEraId = eraId;
    this.fetchEraData(this.clusterId);
  }
}

export const paymentsHistoryStore = new PaymentsHistoryStore();
