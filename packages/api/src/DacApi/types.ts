type WrapperResponseEhdUsageNumbers = {
  gets: number;
  puts: number;
  transferredBytes: number;
};

export interface EraDetail {
  era: number;

  customers: Record<string, WrapperResponseEhdUsageNumbers>;

  providers: Record<string, WrapperResponseEhdUsageNumbers>;

  token_estimates: {
    total_customer_charges: number;
    total_gets_value: number;
    total_puts_value: number;
    total_traffic_value: number;
  } | null;

  total_customers: WrapperResponseEhdUsageNumbers;

  total_providers: WrapperResponseEhdUsageNumbers;
  status: 'paid' | 'pending' | 'failed';
}
