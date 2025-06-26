import React from 'react';
import { Application } from './types';

import contentDelivery from './ContentDelivery';
import activityCapture from './ActivityCapture';
import contentStorage from './ContentStorage';
// import TopUpHistory from '../routes/TopUpHistory';
// import HistoryIcon from '@mui/icons-material/History';

const applications: Application[] = [
  contentStorage,
  contentDelivery,
  activityCapture,
  // {
  //   rootPath: 'topup-history',
  //   rootComponent: TopUpHistory,
  //   title: 'TopUp History',
  //   description: 'View your top-up transaction history',
  //   icon: React.createElement(HistoryIcon),
  // },
];

export * from './types';

export default applications;
