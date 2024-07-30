import { RewardWidget } from '@developer-console/ui';
import { observer } from 'mobx-react-lite';
import { useQuestsStore } from '~/hooks';

export type QuestStatusProps = {
  name: 'uploadFile';
};

const QuestStatus = ({ name }: QuestStatusProps) => {
  const store = useQuestsStore();

  return <RewardWidget title="Upload your first file" amount={50} done={store.isCompleted(name)} />;
};

export default observer(QuestStatus);
