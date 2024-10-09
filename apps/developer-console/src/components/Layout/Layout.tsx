import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Layout as UiLayout, LayoutProps as UiLayoutProps, useMessages } from '@cluster-apps/ui';
import ReactConfetti from 'react-confetti';

import { DDC_CLUSTER_NAME, FEATURE_USER_ONBOARDING } from '~/constants';
import { useQuestsStore } from '~/hooks';

export type LayoutProps = UiLayoutProps;

/**
 * TODO: Remove quests confetti and notification from this component
 */
const Layout = (props: LayoutProps) => {
  const store = useQuestsStore();
  const [isConfetti, showConfetti] = useState(false);
  const { showMessage } = useMessages();

  const isCompleted = store.isCompleted('uploadFile');
  const isNotified = store.isNotified('uploadFile');

  useEffect(() => {
    if (isCompleted && !isNotified) {
      store.markNotified('uploadFile');

      showConfetti(true);
      showMessage({
        message: FEATURE_USER_ONBOARDING
          ? 'Congrats! You just earned 50 CERE tokens'
          : 'Congrats! You just uploaded your first file(s) to DDC',
        appearance: 'success',
        autoDismiss: true,
      });

      setTimeout(() => showConfetti(false), 6000);
    }
  }, [isCompleted, store, isNotified, showMessage]);

  return (
    <>
      <UiLayout {...props} title={`${DDC_CLUSTER_NAME} Developer Console`} />

      {isConfetti && <ReactConfetti />}
    </>
  );
};

export default observer(Layout);
