import { init, captureException, captureMessage, BrowserOptions, SeverityLevel } from '@sentry/react';

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

  message = (message: string, level: Exclude<SeverityLevel, 'fatal'> = 'log') => {
    console[level === 'warning' ? 'warn' : level]('Reporting:', message);

    captureMessage(message, {
      level,
      tags: {},
    });
  };
}
