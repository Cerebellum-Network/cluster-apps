import axios, { AxiosError } from 'axios';

import { VDR_SERVICE_ENDPOINT } from '../constants.ts';
import { CustomerEraRecord, CustomerErasParams, ProviderEraRecord, ProviderErasParams } from './types.ts';

export class VdrServiceApi {
  private readonly baseUrl: string = `${VDR_SERVICE_ENDPOINT}/api`;

  async getCustomerEras(customerId: string, params?: CustomerErasParams): Promise<CustomerEraRecord[]> {
    try {
      const response = await axios.get<CustomerEraRecord[]>(`${this.baseUrl}/customer/${customerId}/eras`, { params });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          return [];
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        if (error.response) {
          throw new Error('Failed to load usage data. Please try again.');
        }
      }
      throw new Error('Unable to connect. Please check your connection.');
    }
  }

  async getCustomerEra(customerId: string, eraId: number): Promise<CustomerEraRecord | null> {
    try {
      const response = await axios.get<CustomerEraRecord>(`${this.baseUrl}/customer/${customerId}/era/${eraId}`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          return null;
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        if (error.response) {
          throw new Error('Failed to load usage data. Please try again.');
        }
      }
      throw new Error('Unable to connect. Please check your connection.');
    }
  }

  async getProviderEras(providerId: string, params?: ProviderErasParams): Promise<ProviderEraRecord[]> {
    try {
      const response = await axios.get<ProviderEraRecord[]>(`${this.baseUrl}/provider/${providerId}/eras`, { params });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          return [];
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        if (error.response) {
          throw new Error('Failed to load usage data. Please try again.');
        }
      }
      throw new Error('Unable to connect. Please check your connection.');
    }
  }

  async getProviderEra(providerId: string, eraId: number): Promise<ProviderEraRecord | null> {
    try {
      const response = await axios.get<ProviderEraRecord>(`${this.baseUrl}/provider/${providerId}/era/${eraId}`);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
          return null;
        }
        if (error.response && error.response.status >= 500) {
          throw new Error('Service temporarily unavailable. Please try again later.');
        }
        if (error.response) {
          throw new Error('Failed to load usage data. Please try again.');
        }
      }
      throw new Error('Unable to connect. Please check your connection.');
    }
  }
}
