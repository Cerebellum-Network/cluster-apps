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
  allErasDetails: EraDetail[] = [];
  buckets: IndexedBucket[] = [];
  isLoading: boolean = false;
  isInitializing: boolean = false;
  error: string | null = null;
  accountId: string | null = null;

  // Applied filter values
  selectedEraId: number | null = null;
  selectedBucketIds: string[] = [];
  selectedPeriod: string = 'this_month';

  // Temporary filter values (buffer state)
  tempSelectedEraId: number | null = null;
  tempSelectedBucketIds: string[] = [];
  tempSelectedPeriod: string = 'this_month';

  // Filtered era options based on selected buckets
  filteredEras: number[] = [];

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

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

  async fetchAllData() {
    this.isLoading = true;
    this.error = null;

    try {
      // Get all eras
      const eras = await this.dacApi.getEras(this.clusterId);

      runInAction(() => {
        this.eras = eras;
      });

      // Fetch details for all eras
      const erasDetailsPromises = eras.map((eraId) => this.dacApi.getEraDetails(this.clusterId, eraId));

      const allErasDetails = await Promise.all(erasDetailsPromises);

      runInAction(() => {
        this.allErasDetails = allErasDetails;

        // Default to first bucket if available
        if (this.buckets.length > 0 && this.selectedBucketIds.length === 0) {
          this.selectedBucketIds = [this.buckets[0].id.toString()];
          this.tempSelectedBucketIds = [this.buckets[0].id.toString()];
          this.updateFilteredEras();
        }
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to fetch data';
      });
    } finally {
      runInAction(() => {
        this.isLoading = false;
      });
    }
  }

  async fetchBuckets() {
    if (!this.accountId) return;
    this.isInitializing = true;
    this.error = null;

    try {
      const account = await this.indexerApi.getAccount(this.accountId);

      runInAction(() => {
        this.buckets = account.buckets;

        // Default to first bucket
        if (account.buckets.length > 0) {
          this.selectedBucketIds = [account.buckets[0].id.toString()];
          this.tempSelectedBucketIds = [account.buckets[0].id.toString()];
        }

        // Now that we have buckets, fetch all other data
        this.fetchAllData();
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : 'Failed to fetch buckets';
      });
    } finally {
      runInAction(() => {
        this.isInitializing = false;
      });
    }
  }

  // Update filtered eras based on selected buckets
  updateFilteredEras() {
    if (this.selectedBucketIds.length === 0) {
      this.filteredEras = this.eras;
      return;
    }

    // Find eras that have data for any of the selected buckets
    const filteredEras = this.allErasDetails
      .filter((era) => {
        if (!era.buckets) return false;

        // Check if any of the selected buckets have data in this era
        return this.selectedBucketIds.some(
          (bucketId) =>
            bucketId in era.buckets &&
            (era.buckets[bucketId].gets > 0 ||
              era.buckets[bucketId].puts > 0 ||
              era.buckets[bucketId].transferredBytes > 0),
        );
      })
      .map((era) => era.era);

    this.filteredEras = filteredEras;

    // If current era is not in filtered list, select the first available
    if (filteredEras.length > 0 && (this.selectedEraId === null || !filteredEras.includes(this.selectedEraId))) {
      this.selectedEraId = filteredEras[0];
      this.tempSelectedEraId = filteredEras[0];
      this.fetchEraData();
    } else if (filteredEras.length === 0) {
      // No matching eras, clear selection
      this.selectedEraId = null;
      this.tempSelectedEraId = null;
      this.eraData = [];
    }
  }

  async fetchEraData() {
    if (!this.selectedEraId || !this.clusterId) return;

    this.isLoading = true;
    this.error = null;

    try {
      const eraDetails = await this.dacApi.getEraDetails(this.clusterId, this.selectedEraId);

      runInAction(() => {
        this.eraData = [eraDetails]; // Use array for backwards compatibility
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

  setTempBuckets(bucketIds: string[]) {
    this.tempSelectedBucketIds = bucketIds;
  }

  addTempBucket(bucketId: string) {
    if (!this.tempSelectedBucketIds.includes(bucketId)) {
      this.tempSelectedBucketIds.push(bucketId);
    }
  }

  removeTempBucket(bucketId: string) {
    this.tempSelectedBucketIds = this.tempSelectedBucketIds.filter((id) => id !== bucketId);
  }

  toggleTempBucket(bucketId: string) {
    if (this.tempSelectedBucketIds.includes(bucketId)) {
      this.removeTempBucket(bucketId);
    } else {
      this.addTempBucket(bucketId);
    }
  }

  setTempPeriod(period: string) {
    this.tempSelectedPeriod = period;
  }

  // Apply filters and fetch data
  applyFilters() {
    let shouldFetch = false;

    // Update only if values have changed
    if (JSON.stringify(this.tempSelectedBucketIds) !== JSON.stringify(this.selectedBucketIds)) {
      this.selectedBucketIds = [...this.tempSelectedBucketIds];
      this.updateFilteredEras(); // This will update era options
      shouldFetch = true;
    }

    if (this.tempSelectedEraId !== this.selectedEraId) {
      this.selectedEraId = this.tempSelectedEraId;
      shouldFetch = true;
    }

    if (this.tempSelectedPeriod !== this.selectedPeriod) {
      this.selectedPeriod = this.tempSelectedPeriod;
      shouldFetch = true;
    }

    if (shouldFetch && this.selectedEraId) {
      this.fetchEraData();
    }
  }

  // Legacy methods for backward compatibility
  setSelectedEra(eraId: number) {
    this.setTempEra(eraId);
  }

  setSelectedBucket(bucketId: string | null) {
    if (bucketId) {
      this.setTempBuckets([bucketId]);
    } else {
      this.setTempBuckets([]);
    }
  }

  setSelectedPeriod(period: string) {
    this.setTempPeriod(period);
  }

  // Helper methods for filtering data based on selected filters
  getFilteredEraData(): EraDetail[] {
    if (this.eraData.length === 0) {
      return [];
    }

    // If no buckets selected, return all era data
    if (this.selectedBucketIds.length === 0) {
      return this.eraData;
    }

    // Filter by selected bucket IDs
    return this.eraData.map((era) => {
      // Create a bucket object with only the selected buckets
      const filteredBuckets: Record<string, any> = {};
      let totalGets = 0;
      let totalPuts = 0;
      let totalTransferredBytes = 0;

      this.selectedBucketIds.forEach((bucketId) => {
        if (era.buckets && bucketId in era.buckets) {
          filteredBuckets[bucketId] = era.buckets[bucketId];
          totalGets += era.buckets[bucketId].gets || 0;
          totalPuts += era.buckets[bucketId].puts || 0;
          totalTransferredBytes += era.buckets[bucketId].transferredBytes || 0;
        }
      });

      // Create a new era object with only the selected buckets
      return {
        ...era,
        buckets: filteredBuckets,
        // Update totals to reflect only the selected buckets
        total_buckets: {
          gets: totalGets,
          puts: totalPuts,
          transferredBytes: totalTransferredBytes,
        },
      };
    });
  }

  // Get user's bucket data from era
  getUserBucketData(era: EraDetail): Record<string, any> {
    const result: Record<string, any> = {};

    // Map user's buckets to data in the era
    this.buckets.forEach((bucket) => {
      const bucketId = bucket.id.toString();
      if (era.buckets && bucketId in era.buckets) {
        result[bucketId] = era.buckets[bucketId];
      }
    });

    return result;
  }

  // Calculate total usage for selected buckets
  getSelectedBucketsTotal(era: EraDetail): { gets: number; puts: number; transferredBytes: number; totalCost: number } {
    let gets = 0;
    let puts = 0;
    let transferredBytes = 0;
    let totalCost = 0;

    this.selectedBucketIds.forEach((bucketId) => {
      if (era.buckets && bucketId in era.buckets) {
        const bucketData = era.buckets[bucketId];
        gets += bucketData.gets || 0;
        puts += bucketData.puts || 0;
        transferredBytes += bucketData.transferredBytes || 0;
      }

      // Add bucket cost if available
      if (era.token_estimates?.bucket_estimates && bucketId in era.token_estimates.bucket_estimates) {
        totalCost += era.token_estimates.bucket_estimates[bucketId].total_value || 0;
      }
    });

    return { gets, puts, transferredBytes, totalCost };
  }
}
