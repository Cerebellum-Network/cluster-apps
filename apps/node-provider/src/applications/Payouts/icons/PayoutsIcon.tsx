import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@cluster-apps/ui';

export const PayoutsIcon = memo((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 40 40" fill="none" sx={{ fill: 'none' }}>
    <rect x="1" y="1" width="34" height="34" rx="6.8" stroke="#818083" strokeWidth="1.5" />
    <rect x="6.77075" y="18.2673" width="6.27739" height="11.0184" rx="1.7" stroke="#818083" strokeWidth="1.5" />
    <rect x="14.8606" y="6.71436" width="6.27739" height="22.5704" rx="1.7" stroke="#818083" strokeWidth="1.5" />
    <rect x="22.949" y="12.4136" width="6.27739" height="16.8718" rx="1.7" stroke="#818083" strokeWidth="1.5" />
  </SvgIcon>
));
