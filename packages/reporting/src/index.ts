import { SENTRY_DNS } from './constants';
import { Reporting } from './Reporting';

export { ErrorBoundary, type ErrorBoundaryProps } from '@sentry/react';

const defaultInstance = new Reporting({
  dsn: SENTRY_DNS,
  enabled: !!SENTRY_DNS,
});

export const reportError = defaultInstance.error;
export const reportMesssage = defaultInstance.message;
export const setUser = defaultInstance.setUser;
export const clearUser = defaultInstance.clearUser;
export const bucketCreated = defaultInstance.bucketCreated;
export const userSignedUp = defaultInstance.userSignedUp;

export default defaultInstance;
