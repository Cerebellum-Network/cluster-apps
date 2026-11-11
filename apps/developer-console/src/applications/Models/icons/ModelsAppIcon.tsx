import { memo } from 'react';
import { SvgIcon, SvgIconProps } from '@cluster-apps/ui';

/** A chip glyph for the Models / inference app (pins + inner core). */
export const ModelsAppIcon = memo((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 38 38">
    <rect
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      x={9}
      y={9}
      width={20}
      height={20}
      rx={3}
    />
    <rect fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" x={15} y={15} width={8} height={8} rx={1.5} />
    <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      {/* top pins */}
      <path d="M14 9V5M19 9V5M24 9V5" />
      {/* bottom pins */}
      <path d="M14 33v-4M19 33v-4M24 33v-4" />
      {/* left pins */}
      <path d="M9 14H5M9 19H5M9 24H5" />
      {/* right pins */}
      <path d="M33 14h-4M33 19h-4M33 24h-4" />
    </g>
  </SvgIcon>
));
