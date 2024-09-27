import axios from 'axios';
import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants.ts';

export class ClusterManagementApi {
  constructor(protected readonly baseUrl = `${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/`) {}

  protected readonly api = axios.create({
    baseURL: this.baseUrl,
  });

  async addContactToBrevo(email: string) {
    await axios.post(`${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/add-brevo-contact`, { email });
  }
}
