import type { BrowserOptions } from '@sentry/react';

export class Sentry {
  private sentry?: any;
  private setReady = () => {};
  private isReady = new Promise<void>((resolve) => {
    this.setReady = resolve;
  });

  constructor(private options: BrowserOptions = {}) {}

  async init() {
    if (!this.options.enabled) {
      return this.setReady();
    }

    const { init, captureException, captureMessage } = await import('@sentry/react');

    init(this.options);
    this.sentry = { captureException, captureMessage };

    this.setReady();
  }

  error = async (error: any) => {
    console.error(error);

    await this.isReady;
    this.sentry?.captureException(error);
  };

  message = async (message: string) => {
    console.log(message);

    await this.isReady;
    this.sentry?.captureMessage(message);
  };
}
