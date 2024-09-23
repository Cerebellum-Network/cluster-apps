import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@cluster-apps/ui';

export const CdnDocsIcon = memo((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 79 82" sx={{ fill: 'none' }}>
    <circle cx={39.379} cy={42.982} r={38.101} fill="#5865F2" />
    <circle cx={39.379} cy={42.982} r={38.101} fill="#5865F2" />
    <path
      fill="#fff"
      d="M29.359 29.637c0-1.86 2.026-3.011 3.625-2.06L53.472 39.77c1.562.93 1.562 3.192 0 4.121L32.984 56.088c-1.6.952-3.625-.2-3.625-2.06v-24.39Z"
    />
    <path
      fill="#fff"
      stroke="#5865F2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="M1.283 20.66s9.66.83 9.66-19.01c0 0-.105 19.055 9.244 19.055 0 0-9.454 1.252-9.454 11.698 0 0 0-11.74-9.455-11.74l.005-.004ZM58.576 64.577s9.66.832 9.66-19.01c0 0-.106 19.056 9.244 19.056 0 0-9.455 1.252-9.455 11.698 0 0 0-11.74-9.454-11.74l.005-.004Z"
    />
    <path
      stroke="#5865F2"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M70.686 10.202a2.66 2.66 0 1 0 0-5.32 2.66 2.66 0 0 0 0 5.32Z"
    />
    <path fill="#5865F2" d="M3.186 68.786a1.907 1.907 0 1 0 0-3.815 1.907 1.907 0 0 0 0 3.815Z" />
  </SvgIcon>
));
