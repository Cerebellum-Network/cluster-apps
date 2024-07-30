import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Layout as UiLayout, LayoutProps as UiLayoutProps, useMessages } from '@developer-console/ui';
import ReactConfetti from 'react-confetti';

import { DDC_CLUSTER_NAME } from '~/constants';
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
        message: 'Congratulations! You just earned 50 points.',
        appearance: 'success',
        autoDismiss: true,
      });

      const to = setTimeout(() => {
        showConfetti(false);

        return () => clearTimeout(to);
      }, 6000);
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
