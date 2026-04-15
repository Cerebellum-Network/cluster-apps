const BILLING_API_BASE_URL = import.meta.env.VITE_BILLING_API_BASE_URL || 'http://localhost:8080/api';

export interface EraUsageDetail {
  era_id: number;
  transferred_bytes: number;
  stored_bytes: number;
  gets: number;
  puts: number;
  computes: number;
  cpu_units: number;
  gpu_units: number;
  ram_units: number;
  tokens_charged?: number;
}

export interface CustomerActivity {
  customer_id: string;
  eras: EraUsageDetail[];
}

export class BillingApi {
  private readonly baseUrl: string = BILLING_API_BASE_URL;

  async getCustomerActivity(customerId: string): Promise<CustomerActivity> {
    const response = await fetch(`${this.baseUrl}/activity/customer/${encodeURIComponent(customerId)}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch customer activity: ${response.statusText}`);
    }

    return response.json();
  }
}
