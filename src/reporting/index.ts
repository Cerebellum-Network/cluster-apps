import { APP_VERSION, APP_ENV, SENTRY_DNS } from '../constants';
import { Sentry } from './Sentry';

const Reporting = new Sentry({
  dsn: SENTRY_DNS,
  enabled: !!SENTRY_DNS,
  release: `developer-console-client@${APP_VERSION}`,
  environment: APP_ENV,
});

export const reportError = Reporting.error;
export const reportMesssage = Reporting.message;

export default Reporting;
