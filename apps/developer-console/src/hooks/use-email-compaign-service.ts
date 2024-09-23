import { useRef } from 'react';
import { ClusterManagementApi } from '@cluster-apps/api';

export const useEmailCampaignService = () => {
  const emailCampaignServiceRef = useRef(new ClusterManagementApi());
  return emailCampaignServiceRef.current;
};
