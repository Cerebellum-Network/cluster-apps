import { makeAutoObservable } from 'mobx';
import { fromPromise, IPromiseBasedObservable } from 'mobx-utils';
import { BillingApi } from '@cluster-apps/api';

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
  totalStoredBytes: number;
  totalComputes: number;
  totalCpuUnits: number;
  totalGpuUnits: number;
  totalRamUnits: number;
  totalTokensCharged: number;
  eraDetails: Array<{
    eraId: number;
    gets: number;
    puts: number;
    transferredBytes: number;
    storedBytes: number;
    computes: number;
    cpuUnits: number;
    gpuUnits: number;
    ramUnits: number;
    tokensCharged?: number;
    // Change from previous era (for comparison)
    changes?: {
      gets: number;
      puts: number;
      transferredBytes: number;
      storedBytes: number;
      computes: number;
      cpuUnits: number;
      gpuUnits: number;
      ramUnits: number;
    };
  }>;
}

export class ActivityStore {
  private billingApi = new BillingApi();
  private activityPromise: IPromiseBasedObservable<CustomerActivity> | null = null;
  private lastFetchedCustomerId: string | null = null;

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

  get hasData() {
    return this.activityPromise?.state === 'fulfilled';
  }

  get hasError() {
    return this.activityPromise?.state === 'rejected';
  }

  async fetchCustomerActivity(_customerId: string) {
    try {
      // Convert encoded address to raw wallet address for billing API calls
      const rawWalletAddress = getRawAddressFromEncoded(_customerId);

      if (this.lastFetchedCustomerId === rawWalletAddress && (this.hasData || this.isLoading)) {
        return;
      }

      this.lastFetchedCustomerId = rawWalletAddress;
      // Use the provided customer id
      this.activityPromise = fromPromise(this.loadCustomerActivity(rawWalletAddress));
    } catch (error) {
      console.error('Error fetching customer activity:', error);
      throw error;
    }
  }

  async refreshCustomerActivity(_customerId: string) {
    try {
      const rawWalletAddress = getRawAddressFromEncoded(_customerId);
      this.lastFetchedCustomerId = rawWalletAddress;
      this.activityPromise = fromPromise(this.loadCustomerActivity(rawWalletAddress));
    } catch (error) {
      console.error('Error refreshing customer activity:', error);
      throw error;
    }
  }

  reset() {
    this.activityPromise = null;
    this.lastFetchedCustomerId = null;
  }

  private async loadCustomerActivity(customerId: string): Promise<CustomerActivity> {
    try {
      const billingData = await this.billingApi.getCustomerActivity(customerId);

      let totalGets = 0;
      let totalPuts = 0;
      let totalTransferredBytes = 0;
      let totalStoredBytes = 0;
      let totalComputes = 0;
      let totalCpuUnits = 0;
      let totalGpuUnits = 0;
      let totalRamUnits = 0;
      let totalTokensCharged = 0;
      const eraDetails: CustomerActivity['eraDetails'] = [];

      // Sort eras by era_id descending (newest first)
      const sortedEras = [...billingData.eras].sort((a, b) => b.era_id - a.era_id);

      for (let i = 0; i < sortedEras.length; i++) {
        const era = sortedEras[i];
        const previousEra = i < sortedEras.length - 1 ? sortedEras[i + 1] : null;

        totalGets += era.gets;
        totalPuts += era.puts;
        totalTransferredBytes += era.transferred_bytes;
        totalStoredBytes += era.stored_bytes;
        totalComputes += era.computes || 0;
        totalCpuUnits += era.cpu_units || 0;
        totalGpuUnits += era.gpu_units || 0;
        totalRamUnits += era.ram_units || 0;
        totalTokensCharged += era.tokens_charged || 0;

        // Calculate changes from previous era
        const changes = previousEra
          ? {
              gets: era.gets - (previousEra.gets || 0),
              puts: era.puts - (previousEra.puts || 0),
              transferredBytes: era.transferred_bytes - (previousEra.transferred_bytes || 0),
              storedBytes: era.stored_bytes - (previousEra.stored_bytes || 0),
              computes: (era.computes || 0) - (previousEra.computes || 0),
              cpuUnits: (era.cpu_units || 0) - (previousEra.cpu_units || 0),
              gpuUnits: (era.gpu_units || 0) - (previousEra.gpu_units || 0),
              ramUnits: (era.ram_units || 0) - (previousEra.ram_units || 0),
            }
          : undefined;

        eraDetails.push({
          eraId: era.era_id,
          gets: era.gets,
          puts: era.puts,
          transferredBytes: era.transferred_bytes,
          storedBytes: era.stored_bytes,
          computes: era.computes || 0,
          cpuUnits: era.cpu_units || 0,
          gpuUnits: era.gpu_units || 0,
          ramUnits: era.ram_units || 0,
          tokensCharged: era.tokens_charged,
          changes,
        });
      }

      return {
        customerId,
        totalGets,
        totalPuts,
        totalTransferredBytes,
        totalStoredBytes,
        totalComputes,
        totalCpuUnits,
        totalGpuUnits,
        totalRamUnits,
        totalTokensCharged,
        eraDetails,
      };
    } catch (err) {
      console.error('Failed to load customer activity:', err);
      throw err;
    }
  }
}
