import { observer } from 'mobx-react-lite';
import { Typography } from '@developer-console/ui';

export type SampleComponentProps = {
  text?: string;
};

const SampleComponent = ({ text }: SampleComponentProps) => {
  return <Typography>{text}</Typography>;
};

export default observer(SampleComponent);
