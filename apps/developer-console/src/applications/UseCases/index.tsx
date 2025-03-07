import { CasesOutlined as UseCasesIcon } from '@mui/icons-material';
import { Application } from '../types';

import UseCases from './UseCases';

const application: Application = {
  rootComponent: UseCases,
  rootPath: 'use-cases',
  title: 'Use Cases',
  description: 'Explore use cases for Cere Network',
  icon: <UseCasesIcon />,
};

export default application; 