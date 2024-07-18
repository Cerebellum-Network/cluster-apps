import { observer } from 'mobx-react-lite';
import { Outlet } from 'react-router-dom';

const App = () => <Outlet />;

export default observer(App);
