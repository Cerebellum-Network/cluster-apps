import {
  init,
  captureException,
  captureMessage,
  BrowserOptions,
  SeverityLevel,
  setUser,
  EventHint,
} from '@sentry/react';

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

  error = (error: any, hint?: EventHint) => {
    console.error('Reporting:', error);

    captureException(error, hint);
  };

  message = (message: string, level: Exclude<SeverityLevel, 'fatal'> = 'log', tags: Record<string, any>) => {
    console[level === 'warning' ? 'warn' : level]('Reporting:', message);

    captureMessage(message, { level, tags });
  };

  setUser = (user: { id: string; username?: string; email?: string }) => {
    setUser(user);
  };

  clearUser = () => {
    setUser(null);
  };

  bucketCreated = (bucketId: bigint) => {
    this.message(`Bucket created: ${bucketId}`, 'info', {
      event: 'bucketCreated',
      bucketId: bucketId.toString(),
    });
  };

  userSignedUp = (walletId: string) => {
    this.message(`User signed up: ${walletId}`, 'info', { event: 'userSignedUp', walletId });
  };
}
