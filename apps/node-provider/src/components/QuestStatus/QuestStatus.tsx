import { RewardWidget } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useAccountStore, useQuestsStore } from '~/hooks';

export type QuestStatusProps = {
  name: 'uploadFile';
};

const QuestStatus = ({ name }: QuestStatusProps) => {
  const store = useQuestsStore();
  const account = useAccountStore();
  return (
    <RewardWidget
      title="Upload your first file"
      amount={50}
      done={store.isCompleted(name) || (account.buckets || []).length >= 1}
    />
  );
};

export default observer(QuestStatus);
