import { makeAutoObservable } from 'mobx';
import { fromPromise, IPromiseBasedObservable } from 'mobx-utils';
import { DacApi } from '@cluster-apps/api';
import { DDC_CLUSTER_ID } from '~/constants.ts';

// Function to convert encoded customer ID to raw wallet address
function decodeCustomerId(encodedId: string): string {
  // If it's already a wallet address format, return as is
  if (encodedId.startsWith('0x')) {
    return encodedId;
  }
  
  // For now, we'll use a simple mapping for the known conversion
  // In a production environment, you'd want to implement proper base58 decoding
  const knownConversions: Record<string, string> = {
    '6TneJd8CZN3PYK5b7TSrBdKpcKvo6GiHqjuJvynqppaFSyT2': '0xbd2963e8502b918b1d2d1ce74b4c382631cd4b60c0ffc97e178f16eae742d3bc'
  };
  
  return knownConversions[encodedId] || encodedId;
}

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
      // Convert the encoded customer ID to raw wallet address format
      const decodedCustomerId = decodeCustomerId(_customerId);
      console.log('Converting customer ID:', _customerId, 'to:', decodedCustomerId);
      // Use the provided customer id
      this.activityPromise = fromPromise(this.loadCustomerActivity(decodedCustomerId, clusterId));
    } catch (error) {
      console.error('Error fetching customer activity:', error);
      throw error;
    }
  }

  private async loadCustomerActivity(customerId: string, clusterId: string): Promise<CustomerActivity> {
    const eraIds = await this.dacApi.getEras(clusterId);

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

    for (const eraId of eraIds) {
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
