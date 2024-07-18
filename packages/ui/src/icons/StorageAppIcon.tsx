import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const StorageAppIcon = memo((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 38 29">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      d="M6.254 13.337v-.085h1c.064 0 .128 0 .191.002.219-1.61.699-3.608 1.751-5.339C10.523 5.733 12.756 4 16.323 4c2.385 0 4.175.811 5.474 2.077 1.274 1.241 2.014 2.857 2.447 4.39.245.87.399 1.734.492 2.524 1.078-1.061 2.715-1.952 5.113-1.952 1.42 0 2.592.314 3.553.803h.001C35.655 12.993 37 15.345 37 17.832v.77c0 4.868-3.95 8.814-8.82 8.814H6.864A5.862 5.862 0 0 1 1 21.556v-1.933c0-3.11 2.244-5.789 5.254-6.286Z"
    />
  </SvgIcon>
));
