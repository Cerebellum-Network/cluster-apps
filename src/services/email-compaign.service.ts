import axios from 'axios';
import { parseResponse } from '~/helpers';
import { CLUSTER_MANAGEMENT_API_URL } from '~/constants.ts';

export class EmailCampaignService {
  constructor(protected readonly baseUrl = `${CLUSTER_MANAGEMENT_API_URL}/email-campaigns/`) {}

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
