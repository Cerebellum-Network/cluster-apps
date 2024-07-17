import { observer } from 'mobx-react-lite';

import { SampleComponent } from '~/components';

const Onboarding = () => {
  return <SampleComponent text="Start Journey" />;
};

export default observer(Onboarding);
