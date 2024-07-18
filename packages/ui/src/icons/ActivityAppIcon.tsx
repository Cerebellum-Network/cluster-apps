import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const ActivityAppIcon = memo((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 36 36">
    <rect fill="none" stroke="currentColor" width={34} height={34} x={1} y={1} strokeWidth={1.5} rx={6.8} />
    <rect
      fill="none"
      stroke="currentColor"
      width={6.277}
      height={11.018}
      x={6.771}
      y={18.267}
      strokeWidth={1.5}
      rx={1.7}
    />
    <rect
      fill="none"
      stroke="currentColor"
      width={6.277}
      height={22.57}
      x={14.861}
      y={6.714}
      strokeWidth={1.5}
      rx={1.7}
    />
    <rect
      fill="none"
      stroke="currentColor"
      width={6.277}
      height={16.872}
      x={22.949}
      y={12.414}
      strokeWidth={1.5}
      rx={1.7}
    />
  </SvgIcon>
));
