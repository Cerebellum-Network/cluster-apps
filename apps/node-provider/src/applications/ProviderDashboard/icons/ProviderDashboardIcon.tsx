import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@cluster-apps/ui';

export const ProviderDashboardIcon = memo((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 40 40" fill="none" sx={{ fill: 'none' }}>
    <rect x="1" y="1" width="34" height="34" rx="6.8" stroke="#818083" strokeWidth="1.5" />
    <path d="M8 24L14 18L20 21L28 12" stroke="#818083" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="28" cy="12" r="2" stroke="#818083" strokeWidth="1.5" />
    <line x1="8" y1="28" x2="28" y2="28" stroke="#818083" strokeWidth="1.5" strokeLinecap="round" />
  </SvgIcon>
));
