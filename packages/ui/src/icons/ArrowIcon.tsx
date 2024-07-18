import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@mui/material';

export const ArrowIcon = memo((props: SvgIconProps) => (
  <SvgIcon
    {...props}
    sx={{
      width: props.width,
      height: props.height,
    }}
    viewBox="0 0 16 16"
  >
    <path
      d="M10.5567 7.75298L6.13637 3.46652C5.86054 3.19905 5.33325 3.36118 5.33325 3.71345L5.33325 12.2864C5.33325 12.6387 5.86054 12.8008 6.13636 12.5333L10.5567 8.24686C10.7032 8.10476 10.7032 7.89508 10.5567 7.75298Z"
      fill="#818083"
    />
  </SvgIcon>
));
