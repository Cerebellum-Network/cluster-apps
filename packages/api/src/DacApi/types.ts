export interface EraDetail {
  era: number;
  total_customer_charges: number;
  total_gets_value: number;
  total_puts_value: number;
  total_traffic_value: number;
  recordTime: Date;
  status: 'paid' | 'pending' | 'failed';
}
