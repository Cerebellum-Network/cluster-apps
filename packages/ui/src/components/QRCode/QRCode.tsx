import { forwardRef, Ref } from 'react';
import QR, { QRCodeProps as QRProps } from 'react-qr-code';

export type QRCodeProps = Omit<QRProps, 'ref'>;

export const QRCode = forwardRef(({ size = 168, ...props }: QRCodeProps, ref: Ref<SVGElement>) => (
  <QR ref={ref as Ref<any>} size={size} {...props} />
));
