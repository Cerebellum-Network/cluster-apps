import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants';

export type AccessRegistryQueryOptions = {
  signerId: string;
};

export type AccessRegistrySaveOptions = {
  accessToken: string;
};

export class AccessRegistryApi {
  private baseUrl = new URL('/access-registry', CLUSTER_MANAGEMENT_ENDPOINT);

  getAccessList = async (query: AccessRegistryQueryOptions) => {
    const url = new URL('', this.baseUrl);

    url.searchParams.append('signerId', query.signerId);

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });

    const { data } = await response.json();

    return data;
  };

  saveAccess = async (access: AccessRegistrySaveOptions) => {
    const response = await fetch(this.baseUrl, {
      method: 'post',
      body: JSON.stringify(access),
      headers: { 'Content-Type': 'application/json' },
    });

    const { data } = await response.json();

    return data;
  };
}
