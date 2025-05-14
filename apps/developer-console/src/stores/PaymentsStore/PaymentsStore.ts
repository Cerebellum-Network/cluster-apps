import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { DacApi, EraDetail, IndexerApi, IndexedBucket } from '@cluster-apps/api';
import { DDC_CLUSTER_ID } from '~/constants.ts';
import { AccountStore } from '~/stores';

export class PaymentsHistoryStore {
  private dacApi = new DacApi();
  private indexerApi = new IndexerApi();
  private readonly clusterId: string = DDC_CLUSTER_ID;

  eras: number[] = [];
  selectedEraId: number | null = null;
  eraData: EraDetail[] = [];
  buckets: IndexedBucket[] = [];
  selectedBucketId: string | null = null;
  selectedPeriod: string = 'this_month';
  isLoading: boolean = false;
  error: string | null = null;
  accountId: string | null = null;

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);
    this.fetchEras();

    reaction(
      () => this.accountStore.address,
      (address) => {
        if (address) {
          this.accountId = address;
          this.fetchBuckets();
        }
      },
    );
  }

  async fetchEras() {
    this.isLoading = true;
    this.error = null;

    try {
      const eras = await this.dacApi.getEras(this.clusterId);

      runInAction(() => {
        this.eras = eras;

        // Select first era by default if available
        if (eras.length > 0 && !this.selectedEraId) {
          this.selectedEraId = eras[0];
          this.fetchEraData();
        }
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to fetch eras';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async fetchBuckets() {
    if (!this.accountId) return;
    this.isLoading = true;
    this.error = null;

    try {
      // Replace hardcoded account ID with actual authenticated user ID when available
      const account = await this.indexerApi.getAccount(this.accountId);

      runInAction(() => {
        this.buckets = account.buckets;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to fetch buckets';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async fetchEraData() {
    if (!this.clusterId) return;

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
    this.fetchEraData();
  }

  setSelectedBucket(bucketId: string | null) {
    this.selectedBucketId = bucketId;
    this.fetchEraData();
  }

  setSelectedPeriod(period: string) {
    this.selectedPeriod = period;
    this.fetchEraData();
  }

  // Helper methods for filtering data based on selected bucket
  getFilteredEraData(): EraDetail[] {
    if (!this.selectedBucketId) {
      return this.eraData;
    }

    // Filter data for selected bucket
    // This is a placeholder - actual filtering logic will depend on your data structure
    return this.eraData.map((era) => ({
      ...era,
      customers: {
        [this.selectedBucketId!]: era.customers[this.selectedBucketId!] || {
          gets: 0,
          puts: 0,
          transferredBytes: 0,
        },
      },
    }));
  }
}
