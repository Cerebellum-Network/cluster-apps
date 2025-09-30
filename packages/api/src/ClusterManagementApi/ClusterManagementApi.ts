import axios from 'axios';
import { CLUSTER_MANAGEMENT_ENDPOINT } from '../constants.ts';
import { NodeAccessParams, NodeAccessResponse, ComputeTierSelection, ComputeTierSelectionResponse } from './types.ts';

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

  async submitComputeTierSelection(selection: ComputeTierSelection) {
    const response = await axios.post<ComputeTierSelectionResponse>(
      `${CLUSTER_MANAGEMENT_ENDPOINT}/compute-tiers/selection`,
      selection,
    );
    return response.data;
  }

  async getComputeTierSelectionStatus(email: string, publicKey: string) {
    const response = await axios.get<ComputeTierSelectionResponse>(
      `${CLUSTER_MANAGEMENT_ENDPOINT}/compute-tiers/selection/status`,
      {
        params: { email, publicKey },
      },
    );
    return response.data;
  }

  async getComputeTierSelections(email: string) {
    const response = await axios.get<ComputeTierSelectionResponse[]>(
      `${CLUSTER_MANAGEMENT_ENDPOINT}/compute-tiers/selection`,
      {
        params: { email },
      },
    );
    return response.data;
  }

  async getComputeTierSelectionById(id: string) {
    const response = await axios.get<ComputeTierSelectionResponse>(
      `${CLUSTER_MANAGEMENT_ENDPOINT}/compute-tiers/selection/${id}`,
    );
    return response.data;
  }

  async updateComputeTierSelection(id: string, updateData: { status: 'pending' | 'approved' | 'rejected' }) {
    const response = await axios.patch<ComputeTierSelectionResponse>(
      `${CLUSTER_MANAGEMENT_ENDPOINT}/compute-tiers/selection/${id}`,
      updateData,
    );
    return response.data;
  }

  async deleteComputeTierSelection(id: string) {
    await axios.delete(`${CLUSTER_MANAGEMENT_ENDPOINT}/compute-tiers/selection/${id}`);
  }
}
