import { makeAutoObservable } from 'mobx';
import { fromPromise, IPromiseBasedObservable } from 'mobx-utils';
import { DacApi } from '@cluster-apps/api';
import { DDC_CLUSTER_ID } from '~/constants.ts';

export interface CustomerActivity {
  customerId: string;
  totalGets: number;
  totalPuts: number;
  totalTransferredBytes: number;
  totalGetsValue: number;
  totalPutsValue: number;
  totalTrafficValue: number;
  totalValue: number;
  eraDetails: Array<{
    eraId: number;
    gets: number;
    puts: number;
    transferredBytes: number;
    getsValue: number;
    putsValue: number;
    trafficValue: number;
    totalValue: number;
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

  async fetchCustomerActivity(_customerId: string, clusterId: string = DDC_CLUSTER_ID) {
    try {
      // Use the provided customer id
      this.activityPromise = fromPromise(this.loadCustomerActivity(_customerId, clusterId));
    } catch (error) {
      console.error('Error fetching customer activity:', error);
      throw error;
    }
  }

  private async loadCustomerActivity(customerId: string, clusterId: string): Promise<CustomerActivity> {
    const eraIds = await this.dacApi.getEras(clusterId);
    // Only fetch the most recent eras (limit to 10 for performance)
    const recentEraIds = eraIds.slice(-10);

    // Fetch governance params once
    const governanceParams = await this.dacApi.getGovernanceParams(clusterId);
    const unitPerGet = governanceParams.unit_per_get_request;
    const unitPerPut = governanceParams.unit_per_put_request;
    const unitPerMbStreamed = governanceParams.unit_per_mb_streamed;

    let totalGets = 0;
    let totalPuts = 0;
    let totalTransferredBytes = 0;
    let totalGetsValue = 0;
    let totalPutsValue = 0;
    let totalTrafficValue = 0;
    let totalValue = 0;
    const eraDetails: Array<{
      eraId: number;
      gets: number;
      puts: number;
      transferredBytes: number;
      getsValue: number;
      putsValue: number;
      trafficValue: number;
      totalValue: number;
    }> = [];

    for (const eraId of recentEraIds) {
      const eraDetail = await this.dacApi.getCustomerEraDetails(clusterId, eraId, customerId);
      if (!eraDetail || !eraDetail.customers || !eraDetail.customers[customerId]) {
        continue; // Skip this era if no data
      }
      const customerStats = eraDetail.customers[customerId];
      // Calculate values using governance params (no division for trafficValue)
      const getsValue = customerStats.gets * unitPerGet;
      const putsValue = customerStats.puts * unitPerPut;
      const trafficValue = customerStats.transferredBytes * unitPerMbStreamed;
      const eraTotalValue = getsValue + putsValue + trafficValue;

      totalGets += customerStats.gets;
      totalPuts += customerStats.puts;
      totalTransferredBytes += customerStats.transferredBytes;
      totalGetsValue += getsValue;
      totalPutsValue += putsValue;
      totalTrafficValue += trafficValue;
      totalValue += eraTotalValue;

      eraDetails.push({
        eraId: eraDetail.era,
        gets: customerStats.gets,
        puts: customerStats.puts,
        transferredBytes: customerStats.transferredBytes,
        getsValue,
        putsValue,
        trafficValue,
        totalValue: eraTotalValue,
      });
    }

    return {
      customerId,
      totalGets,
      totalPuts,
      totalTransferredBytes,
      totalGetsValue,
      totalPutsValue,
      totalTrafficValue,
      totalValue,
      eraDetails: eraDetails.sort((a, b) => b.eraId - a.eraId), // Sort by era ID descending
    };
  }
}
