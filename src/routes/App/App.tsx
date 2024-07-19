import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '~/hooks';

const App = () => {
  const store = useAppStore();

  useEffect(() => {
    store.init();
  }, [store]);

  return <Outlet />;
};

export default observer(App);
