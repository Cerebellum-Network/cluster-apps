import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants.ts';
import axios from 'axios';
import { parseResponse } from './helpers';

export class ClusterManagementApi {
  constructor(protected readonly baseUrl = `${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/`) {}

  protected readonly api = axios.create({
    baseURL: this.baseUrl,
  });

  async addContactToBrevo(email: string) {
    const response = await axios.post(`${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/add-brevo-contact`, { email });
    return parseResponse(response.data);
  }
}
