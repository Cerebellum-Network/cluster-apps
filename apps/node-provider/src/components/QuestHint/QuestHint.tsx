import { Hint, HintProps } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useQuestsStore } from '~/hooks';

import { QuestName, QuestStep } from '~/stores';

export type QuestHintProps = Omit<HintProps, 'open'> & {
  skip?: boolean;
  quest: QuestName;
  step: QuestStep;
};

const QuestHint = ({ skip = false, ...props }: QuestHintProps) => {
  const store = useQuestsStore();
  const isDone = store.isStepDone(props.quest, props.step);

  return <Hint open={!skip && !isDone} {...props} />;
};

export default observer(QuestHint);
