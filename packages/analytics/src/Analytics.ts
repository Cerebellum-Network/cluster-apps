import TagManager, { TagManagerArgs } from 'react-gtm-module';

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export class Analytics {
  constructor(private options: TagManagerArgs) {}

  init() {
    TagManager.initialize(this.options);
  }

  trackEvent = (event: string, data: Record<string, any> = {}) => {
    window.dataLayer?.push({ event, ...data });
  };
}
