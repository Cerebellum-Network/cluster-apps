import { Hint, HintProps } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { useQuestsStore } from '~/hooks';

import { QuestName, QuestStep } from '~/stores';

export type QuestHintProps = Omit<HintProps, 'open'> & {
  skip?: boolean;
  loading?: boolean;
  quest: QuestName;
  step: QuestStep;
};

const QuestHint = ({ skip = false, loading = false, ...props }: QuestHintProps) => {
  const store = useQuestsStore();
  const isDone = store.isStepDone(props.quest, props.step);

  if (loading) {
    return props.children;
  }

  return <Hint open={!skip && !isDone} {...props} />;
};

export default observer(QuestHint);
