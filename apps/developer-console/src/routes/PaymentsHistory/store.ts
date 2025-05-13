import { makeAutoObservable, runInAction } from 'mobx';
import { DacApi, EraDetail } from '@cluster-apps/api';

export class PaymentsHistoryStore {
  clusters: string[] = [];
  selectedClusterId: string | null = null;
  eraData: EraDetail[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  private dacApi = new DacApi();

  constructor() {
    makeAutoObservable(this);
    this.fetchClusters();
  }

  async fetchClusters() {
    this.isLoading = true;
    this.error = null;

    try {
      const clusters = await this.dacApi.getClusters();

      runInAction(() => {
        this.clusters = clusters;

        // Select first cluster by default if available
        if (clusters.length > 0 && !this.selectedClusterId) {
          this.selectedClusterId = clusters[0];
          this.fetchClusterData(clusters[0]);
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

  async fetchClusterData(clusterId: string) {
    if (!clusterId) return;

    this.isLoading = true;
    this.error = null;

    try {
      const eraData = await this.dacApi.getAllErasDetails(clusterId);

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

  setSelectedCluster(clusterId: string) {
    this.selectedClusterId = clusterId;
    this.fetchClusterData(clusterId);
  }
}

export const paymentsHistoryStore = new PaymentsHistoryStore();
