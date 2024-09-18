import { observer } from 'mobx-react-lite';
import { Layout as UiLayout, LayoutProps as UiLayoutProps } from '@cluster-apps/ui';

export type LayoutProps = UiLayoutProps;

const Layout = (props: LayoutProps) => {
  return <UiLayout {...props} title="Global Access Registry" />;
};

export default observer(Layout);
