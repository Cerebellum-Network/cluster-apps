import { init, captureException, captureMessage, BrowserOptions, SeverityLevel, setUser, setTag } from '@sentry/react';

export type ReportingOptions = Pick<BrowserOptions, 'environment'> & {
  appVersion: string;
  tags?: Record<string, any>;
};

export class Reporting {
  constructor(private options: BrowserOptions) {}

  init({ appVersion, tags, environment }: ReportingOptions) {
    init({
      ...this.options,
      environment,
      release: `developer-console-client@${appVersion}`,
      initialScope: { tags },
    });
  }

  error = (error: any) => {
    console.error('Reporting:', error);

    captureException(error);
  };

  message = (
    message: string,
    level: Exclude<SeverityLevel, 'fatal'> = 'log',
    additionalTags: Record<string, any> = {},
  ) => {
    console[level === 'warning' ? 'warn' : level]('Reporting:', message);

    Object.keys(additionalTags).forEach((key) => {
      setTag(key, additionalTags[key]);
    });

    captureMessage(message, level);
  };

  setUser = (user: { id: string; username?: string; email?: string }) => {
    setUser(user);
  };

  clearUser = () => {
    setUser(null);
  };

  bucketCreated = (bucketId: string) => {
    this.message(`Bucket created: ${bucketId}`, 'info', { event: 'bucketCreated', bucketId });
  };

  userSignedUp = (walletId: string) => {
    this.message(`User signed up: ${walletId}`, 'info', { event: 'userSignedUp', walletId });
  };
}
