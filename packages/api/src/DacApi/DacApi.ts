import { DAC_ENDPOINT } from '../constants.ts';
import { EraDetail } from './types.ts';
import axios from 'axios';

export class DacApi {
  private readonly baseUrl: string = `${DAC_ENDPOINT}/api`;

  async getEras(clusterId: string): Promise<number[]> {
    const response = await axios.get(`${this.baseUrl}/cluster/${clusterId}/eras`);
    return response.data.data;
  }

  async getEraDetails(clusterId: string, eraId: number): Promise<EraDetail> {
    const response = await axios.get(`${this.baseUrl}/cluster/${clusterId}/era/${eraId}`);
    return response.data.data;
  }

  async getAllErasDetails(clusterId: string): Promise<EraDetail[]> {
    const eras = await this.getEras(clusterId);

    // Only fetch the most recent eras (limit to 10 for performance)
    const recentEras = eras.slice(-10);

    const erasDetailsPromises = recentEras.map((eraId) => this.getEraDetails(clusterId, eraId));
    return Promise.all(erasDetailsPromises);
  }
}
