import { Application } from './types';

import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';
import documentation from './Documentation';
import analytics from './Analytics';
import useCases from './UseCases';
import home from './Home';
import grants from './Grants';

// Rename Content Storage to File Manager
contentStorage.title = 'File Manager';
contentStorage.description = 'Upload, manage, and organize your files';

// Rename Activity Capture to Customer Data
activityCapture.title = 'Customer Data';
activityCapture.description = 'Collect and analyze customer behavior data';

const applications: Application[] = [
  home,
  contentStorage,
  activityCapture,
  useCases,
  analytics,
  documentation,
  grants
];

export * from './types';

export default applications;
