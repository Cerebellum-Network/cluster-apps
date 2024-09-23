import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants';
import { AccessRegistryEntity, ApiResponse } from './types';

export type AccessRegistryQueryOptions = {
  signerId: string;
};

export type AccessRegistrySaveOptions = {
  accessToken: string;
};

const mapRecord = (record: AccessRegistryEntity): AccessRegistryEntity => ({
  ...record,
  bucketId: BigInt(record.bucketId),
  expiresAt: new Date(record.expiresAt),
  createdAt: new Date(record.createdAt),
  updatedAt: new Date(record.updatedAt),
});

export class AccessRegistryApi {
  private baseUrl = new URL('/access-registry', CLUSTER_MANAGEMENT_ENDPOINT);

  getAccessList = async (query: AccessRegistryQueryOptions) => {
    const url = new URL('', this.baseUrl);

    url.searchParams.append('signerId', query.signerId);

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    const { data }: ApiResponse<AccessRegistryEntity[]> = await response.json();

    return data.map(mapRecord);
  };

  saveAccess = async (access: AccessRegistrySaveOptions) => {
    const response = await fetch(this.baseUrl, {
      method: 'post',
      body: JSON.stringify(access),
      headers: { 'Content-Type': 'application/json' },
    });

    const { data }: ApiResponse<AccessRegistryEntity> = await response.json();

    return mapRecord(data);
  };
}
