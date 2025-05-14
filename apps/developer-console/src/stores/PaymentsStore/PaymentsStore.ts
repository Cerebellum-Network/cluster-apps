import { makeAutoObservable, reaction, runInAction } from 'mobx';
import { DacApi, EraDetail, IndexerApi, IndexedBucket } from '@cluster-apps/api';
import { DDC_CLUSTER_ID } from '~/constants.ts';
import { AccountStore } from '~/stores';

export class PaymentsHistoryStore {
  private dacApi = new DacApi();
  private indexerApi = new IndexerApi();
  private readonly clusterId: string = DDC_CLUSTER_ID;

  // Current values
  eras: number[] = [];
  eraData: EraDetail[] = [];
  buckets: IndexedBucket[] = [];
  isLoading: boolean = false;
  error: string | null = null;
  accountId: string | null = null;

  // Applied filter values
  selectedEraId: number | null = null;
  selectedBucketId: string | null = null;
  selectedPeriod: string = 'this_month';

  // Temporary filter values (buffer state)
  tempSelectedEraId: number | null = null;
  tempSelectedBucketId: string | null = null;
  tempSelectedPeriod: string = 'this_month';

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
          this.tempSelectedEraId = eras[0];
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

  // Methods for updating temporary filter values
  setTempEra(eraId: number) {
    this.tempSelectedEraId = eraId;
  }

  setTempBucket(bucketId: string | null) {
    this.tempSelectedBucketId = bucketId;
  }

  setTempPeriod(period: string) {
    this.tempSelectedPeriod = period;
  }

  // Apply filters and fetch data
  applyFilters() {
    let shouldFetch = false;

    // Update only if values have changed
    if (this.tempSelectedEraId !== this.selectedEraId) {
      this.selectedEraId = this.tempSelectedEraId;
      shouldFetch = true;
    }

    if (this.tempSelectedBucketId !== this.selectedBucketId) {
      this.selectedBucketId = this.tempSelectedBucketId;
      shouldFetch = true;
    }

    if (this.tempSelectedPeriod !== this.selectedPeriod) {
      this.selectedPeriod = this.tempSelectedPeriod;
      shouldFetch = true;
    }

    if (shouldFetch) {
      this.fetchEraData();
    }
  }

  // Legacy methods for backward compatibility
  setSelectedEra(eraId: number) {
    this.setTempEra(eraId);
  }

  setSelectedBucket(bucketId: string | null) {
    this.setTempBucket(bucketId);
  }

  setSelectedPeriod(period: string) {
    this.setTempPeriod(period);
  }

  // Helper methods for filtering data based on selected filters
  getFilteredEraData(): EraDetail[] {
    let filteredData = this.eraData;

    // Filter by Era ID if selected
    if (this.selectedEraId !== null) {
      filteredData = filteredData.filter((era) => era.era === this.selectedEraId);
    }

    // If no data after era filtering, return empty array
    if (filteredData.length === 0) {
      return [];
    }

    // Filter by Bucket ID if selected
    if (this.selectedBucketId) {
      return filteredData.map((era) => ({
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

    return filteredData;
  }
}
