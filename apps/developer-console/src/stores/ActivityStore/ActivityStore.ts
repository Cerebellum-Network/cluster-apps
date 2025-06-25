import { makeAutoObservable } from 'mobx';
import { fromPromise, IPromiseBasedObservable } from 'mobx-utils';
import { DacApi } from '@cluster-apps/api';
import { DDC_CLUSTER_ID } from '~/constants.ts';

// Function to convert encoded address to raw wallet address
function getRawAddressFromEncoded(encodedAddress: string): string {
  // If it's already a raw address, return as is
  if (encodedAddress.startsWith('0x') && encodedAddress.length === 66) {
    return encodedAddress;
  }

  // Convert Substrate address (base58) to raw wallet address
  try {
    // Remove the network prefix (first byte) and decode base58
    const decoded = decodeBase58(encodedAddress);

    // Remove the first byte (network prefix) and last 2 bytes (checksum)
    const publicKey = decoded.slice(1, -2);

    // Convert to hex format
    return '0x' + Buffer.from(publicKey).toString('hex');
  } catch (error) {
    console.warn('Failed to decode address:', error);
    return encodedAddress;
  }
}

// Base58 decoding function
function decodeBase58(str: string): Uint8Array {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const base = alphabet.length;

  let decoded = 0n;
  let multi = 1n;

  for (let i = str.length - 1; i >= 0; i--) {
    const char = str[i];
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error('Invalid base58 character');
    decoded += BigInt(index) * multi;
    multi *= BigInt(base);
  }

  // Convert to bytes
  const bytes: number[] = [];
  while (decoded > 0n) {
    bytes.unshift(Number(decoded % 256n));
    decoded = decoded / 256n;
  }

  return new Uint8Array(bytes);
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
  private activityPromise: IPromiseBasedObservable<CustomerActivity> | null = null;

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
      // Convert encoded address to raw wallet address for DAC API calls
      const rawWalletAddress = getRawAddressFromEncoded(_customerId);

      // Use the provided customer id
      this.activityPromise = fromPromise(this.loadCustomerActivity(rawWalletAddress, clusterId));
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
      // Use the raw wallet address directly for DAC API calls
      const rawWalletAddress = customerId; // This should already be the raw wallet address
      const eraDetail = await this.dacApi.getCustomerEraDetails(clusterId, eraId, rawWalletAddress);
      if (!eraDetail || !eraDetail.customers || !eraDetail.customers[rawWalletAddress]) {
        continue; // Skip this era if no data
      }
      const customerStats = eraDetail.customers[rawWalletAddress];
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
