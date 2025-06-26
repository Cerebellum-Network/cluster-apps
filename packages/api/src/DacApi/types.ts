type UsageStats = {
  gets: number;
  puts: number;
  transferredBytes: number;
};

type TokenEstimate = {
  gets_value: number;
  puts_value: number;
  total_value: number;
  traffic_value: number;
};

type EstimatesGroup = {
  [key: string]: TokenEstimate;
};

type TokenEstimates = {
  bucket_estimates: EstimatesGroup;
  customer_estimates: EstimatesGroup;
  node_estimates: EstimatesGroup;
  provider_estimates: EstimatesGroup;
  total_customer_charges: number;
  total_gets_value: number;
  total_puts_value: number;
  total_traffic_value: number;
};

type EntityGroup = {
  [key: string]: UsageStats;
};

export interface EraDetail {
  buckets: EntityGroup;
  customers: EntityGroup;
  phs_nodes_aggregates: EntityGroup;
  providers: EntityGroup;
  era: number;
  token_estimates: TokenEstimates;
  total_buckets: UsageStats;
  total_customers: UsageStats;
  total_nodes: UsageStats;
  total_providers: UsageStats;
}
