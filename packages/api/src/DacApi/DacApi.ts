import { DAC_ENDPOINT } from '../constants.ts';
import { EraDetail } from './types.ts';

export class DacApi {
  private readonly baseUrl: string = `${DAC_ENDPOINT}/api`;

  async getClusters(): Promise<string[]> {
    // For demo purposes, return mock data instead of making actual API calls
    return ['19715781', '28461973', '37129485'];
  }

  async getClusterEras(_clusterId: string): Promise<number[]> {
    // For demo purposes, return mock data
    return [1455857, 1455858, 1455859, 1455860, 1455861, 1455862, 1455863, 1455864, 1455865, 1455866];
  }

  async getEraDetails(_clusterId: string, eraId: number): Promise<EraDetail> {
    // For demo purposes, generate random data
    const generateRandomValue = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    // Generate dates spread over the last month
    const now = new Date();
    const daysAgo = generateRandomValue(0, 30);
    const recordTime = new Date(now.setDate(now.getDate() - daysAgo));

    // Generate a random status
    const statuses: Array<'paid' | 'pending' | 'failed'> = ['paid', 'pending', 'failed'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

    return {
      era: eraId,
      total_customer_charges: generateRandomValue(1000, 10000), // $10-$100 range
      total_gets_value: generateRandomValue(100000, 10000000), // ~100KB-10MB
      total_puts_value: generateRandomValue(100000, 5000000), // ~100KB-5MB
      total_traffic_value: generateRandomValue(1000000, 100000000), // ~1MB-100MB
      recordTime,
      status: randomStatus,
    };
  }

  async getAllErasDetails(clusterId: string): Promise<EraDetail[]> {
    const eras = await this.getClusterEras(clusterId);

    // Only fetch the most recent eras (limit to 10 for performance)
    const recentEras = eras.slice(-10);

    const erasDetailsPromises = recentEras.map((eraId) => this.getEraDetails(clusterId, eraId));
    return Promise.all(erasDetailsPromises);
  }
}
