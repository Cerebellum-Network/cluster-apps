import { MenuBookOutlined as DocumentationIcon } from '@mui/icons-material';
import { Application } from '../types';

import Documentation from './Documentation';

const application: Application = {
  rootComponent: Documentation,
  rootPath: 'documentation',
  title: 'Documentation',
  description: 'Learn how to use Cere Network services',
  icon: <DocumentationIcon />,
};

export default application; 