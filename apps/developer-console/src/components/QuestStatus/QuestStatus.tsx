import { RewardWidget } from '@cluster-apps/ui';
import { observer } from 'mobx-react-lite';
import { useAccount, useQuestsStore, useFetchDirs } from '~/hooks';

export type QuestStatusProps = {
  name: 'uploadFile' | 'createBucket';
};

const QuestStatus = ({ name }: QuestStatusProps) => {
  const store = useQuestsStore();
  const account = useAccount();
  const { dirs } = useFetchDirs(account.buckets, account.ddc);

  return (
    <RewardWidget
      title="Upload your first file"
      amount={50}
      done={
        store.isCompleted(name) ||
        ((account.buckets || []).length >= 1 && dirs.filter((s: { cid: string }) => !!s.cid).length > 0)
      }
    />
  );
};

export default observer(QuestStatus);
