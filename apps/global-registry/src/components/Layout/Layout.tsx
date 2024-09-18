import { observer } from 'mobx-react-lite';
import { Layout as UiLayout, LayoutProps as UiLayoutProps } from '@cluster-apps/ui';

import { DDC_CLUSTER_NAME } from '~/constants';

export type LayoutProps = UiLayoutProps;

const Layout = (props: LayoutProps) => {
  return <UiLayout {...props} title={`${DDC_CLUSTER_NAME} Global Access Registry`} />;
};

export default observer(Layout);
