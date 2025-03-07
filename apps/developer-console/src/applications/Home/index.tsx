import { Application } from '../types';
import { HomeIcon } from './icons';
import Home from './Home';

const application: Application = {
  rootComponent: Home,
  rootPath: 'home',
  title: 'Home',
  description: 'Dashboard and navigation',
  icon: <HomeIcon />,
};

export default application; 