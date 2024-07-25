import { observer } from 'mobx-react-lite';
import { Layout as UiLayout, LayoutProps as UiLayoutProps } from '@developer-console/ui';

import { DDC_CLUSTER_NAME } from '~/constants';

export type LayoutProps = UiLayoutProps;

const Layout = (props: LayoutProps) => <UiLayout {...props} title={`${DDC_CLUSTER_NAME} Developer Console`} />;

export default observer(Layout);
