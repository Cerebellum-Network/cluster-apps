import byteSize from 'byte-size';
import {
  init,
  captureException,
  captureMessage,
  BrowserOptions,
  SeverityLevel,
  setUser,
  EventHint,
} from '@sentry/react';

import { getUTMParameters } from './helpers';

export type ReportingOptions = Pick<BrowserOptions, 'environment'> & {
  appVersion: string;
  tags?: Record<string, any>;
};

export type ReportingUser = {
  id: string;
  username?: string;
  email?: string;
};

export type ReportingFile = {
  bucketId: bigint;
  cid: string;
  name: string;
  size: number;
  type: string;
};

export class Reporting {
  constructor(private options: BrowserOptions) {}

  init({ appVersion, tags, environment }: ReportingOptions) {
    const utmParams = getUTMParameters();

    const combinedTags = {
      ...tags,
      ...utmParams,
    };

    init({
      ...this.options,
      environment,
      release: `developer-console-client@${appVersion}`,
      initialScope: { tags: combinedTags },
    });
  }

  error = (error: any, hint?: EventHint) => {
    console.error('Reporting:', error);

    captureException(error, hint);
  };

  message = (message: string, level: Exclude<SeverityLevel, 'fatal'> = 'log', tags?: Record<string, any>) => {
    console[level === 'warning' ? 'warn' : level]('Reporting:', message);

    captureMessage(message, { level, tags });
  };

  setUser = (user: ReportingUser) => setUser(user);
  clearUser = () => setUser(null);

  bucketCreated = (bucketId: bigint) => {
    this.message(`Bucket created: ${bucketId}`, 'info', {
      event: 'bucketCreated',
      bucketId: bucketId.toString(),
    });
  };

  userSignedUp = (walletId: string) => {
    this.message(`User signed up: ${walletId}`, 'info', { event: 'userSignedUp', walletId });
  };

  fileUploaded = (file: ReportingFile) => {
    this.message(`User uploaded a file of type ${file.type} and size ${file.size}`, 'info', {
      event: 'fileUploaded',
      bucketId: file.bucketId.toString(),
      fileCid: file.cid,
      fileName: file.name,
      fileType: file.type,
      fileSizeInBytes: file.size,
      fileSize: byteSize(file.size).toString(),
    });
  };
}
