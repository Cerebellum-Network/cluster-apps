import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants.ts';
import axios from 'axios';
import { parseResponse } from './helpers';

export class ClusterManagementApi {
  constructor(protected readonly baseUrl = `${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/`) {}

  protected readonly api = axios.create({
    baseURL: this.baseUrl,
  });

  async sendEmail(subject: string, body: string, to: string) {
    const response = await this.api.post('send-email', {
      subject,
      body,
      to,
    });
    return parseResponse(response.data);
  }

  async addContact(email: string) {
    const response = await this.api.post('add-contact', { email });
    return parseResponse(response.data);
  }
}
