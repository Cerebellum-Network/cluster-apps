import { observer } from 'mobx-react-lite';
import { Layout, FileManager } from '@developer-console/ui';

const ContentStorage = () => {
  return (
    <Layout>
      <FileManager />
    </Layout>
  );
};

export default observer(ContentStorage);
