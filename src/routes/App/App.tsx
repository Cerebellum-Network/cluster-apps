import { Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '~/hooks';

const App = () => {
  const appStore = useAppStore();

  useEffect(() => {
    appStore.init();
  }, [appStore]);

  /**
   * TODO: Use splash screen instead of "Loading..." text
   */
  return appStore.isReady() ? <Outlet /> : <Typography>Loading...</Typography>;
};

export default observer(App);
