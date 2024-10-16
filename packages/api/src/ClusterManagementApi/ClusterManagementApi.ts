import axios from 'axios';
import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants.ts';
import { NodeAccessParams, NodeAccessResponse } from './types.ts';

export class ClusterManagementApi {
  constructor(protected readonly baseUrl = `${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/`) {}

  protected readonly api = axios.create({
    baseURL: this.baseUrl,
  });

  async addContactToBrevo(email: string) {
    await axios.post(`${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/add-brevo-contact`, { email });
  }

  async addContactToMailjet(email: string) {
    await axios.post(`${CLUSTER_MANAGEMENT_ENDPOINT}/email-campaigns/add-mailjet-contact`, { email });
  }

  async validateNodeConfiguration(nodeParams: NodeAccessParams) {
    return await axios.post<NodeAccessResponse>(`${CLUSTER_MANAGEMENT_ENDPOINT}/probe-ddc-node`, nodeParams);
  }
}
