import { useRef } from 'react';
import { EmailCampaignService } from '~/services/email-compaign.service.ts';

export const useEmailCampaignService = () => {
  const emailCampaignServiceRef = useRef(new EmailCampaignService());
  return emailCampaignServiceRef.current;
};
