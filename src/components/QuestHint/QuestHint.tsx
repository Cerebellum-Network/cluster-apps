import { Hint, HintProps } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';

export type QuestHintProps = Omit<HintProps, 'open'> & {
  skip?: boolean;
};

const QuestHint = ({ skip = false, ...props }: QuestHintProps) => {
  return <Hint open={!skip} {...props} />;
};

export default observer(QuestHint);
