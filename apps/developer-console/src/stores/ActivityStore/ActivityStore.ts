import { makeAutoObservable } from 'mobx';
import { fromPromise, IPromiseBasedObservable } from 'mobx-utils';
import { DacApi } from '@cluster-apps/api';

export interface CustomerActivity {
  customerId: string;
  totalGets: number;
  totalPuts: number;
  totalTransferredBytes: number;
  eraDetails: Array<{
    eraId: number;
    gets: number;
    puts: number;
    transferredBytes: number;
  }>;
}

export class ActivityStore {
  private dacApi = new DacApi();
  private activityPromise?: IPromiseBasedObservable<CustomerActivity>;

  constructor() {
    makeAutoObservable(this);
  }

  get activity() {
    return this.activityPromise?.case({
      fulfilled: (activity) => activity,
      rejected: (error) => {
        console.error('Failed to fetch activity data:', error);
        return null;
      },
    });
  }

  get isLoading() {
    return this.activityPromise?.state === 'pending';
  }

  async fetchCustomerActivity(customerId: string, clusterId: string = '0x825c4b2352850de9986d9d28568db6f0c023a1e3') {
    try {
      this.activityPromise = fromPromise(this.loadCustomerActivity(customerId, clusterId));
    } catch (error) {
      console.error('Error fetching customer activity:', error);
      throw error;
    }
  }

  private async loadCustomerActivity(customerId: string, clusterId: string): Promise<CustomerActivity> {
    const erasDetails = await this.dacApi.getAllErasDetails(clusterId);
    
    let totalGets = 0;
    let totalPuts = 0;
    let totalTransferredBytes = 0;
    const eraDetails: Array<{
      eraId: number;
      gets: number;
      puts: number;
      transferredBytes: number;
    }> = [];

    for (const eraDetail of erasDetails) {
      const customerStats = eraDetail.customers[customerId];
      if (customerStats) {
        totalGets += customerStats.gets;
        totalPuts += customerStats.puts;
        totalTransferredBytes += customerStats.transferredBytes;
        
        eraDetails.push({
          eraId: eraDetail.era,
          gets: customerStats.gets,
          puts: customerStats.puts,
          transferredBytes: customerStats.transferredBytes,
        });
      }
    }

    return {
      customerId,
      totalGets,
      totalPuts,
      totalTransferredBytes,
      eraDetails: eraDetails.sort((a, b) => b.eraId - a.eraId), // Sort by era ID descending
    };
  }
} 