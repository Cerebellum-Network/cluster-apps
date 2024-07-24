import size from 'byte-size';

export type BytesSizeProps = {
  bytes: number;
};

export const BytesSize = ({ bytes }: BytesSizeProps) => {
  return <>{size(bytes).toString()}</>;
};
