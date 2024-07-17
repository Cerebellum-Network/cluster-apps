import { observer } from 'mobx-react-lite';
import { SampleComponent } from '~/components';

const Home = () => {
  return <SampleComponent text="Home page" />;
};

export default observer(Home);
