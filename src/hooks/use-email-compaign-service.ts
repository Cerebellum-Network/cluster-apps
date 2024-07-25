import { useRef } from 'react';
import { ClusterManagementApi } from '@developer-console/api';

export const useEmailCampaignService = () => {
  const emailCampaignServiceRef = useRef(new ClusterManagementApi());
  return emailCampaignServiceRef.current;
};
