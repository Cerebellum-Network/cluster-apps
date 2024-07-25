export enum GoogleAnalyticsId {
  SignIn = 'SIGNIN',
  SignUp = 'SIGNUP',
  SignOut = 'SIGNOUT',

  buildStorageBtn = 'build-storage-btn',
  buildDeliverBtn = 'build-deliver-btn',
  buildAnalyzeBtn = 'build-analyze-btn',
  buildSkipBtn = 'build-skip-btn',

  joinDiscordBtn = 'join-discord-btn',

  createFirstBucketBtn = 'create-first-bucket-btn',
  createBucketBtn = 'another-bucket-btn',
  deleteBucket = 'delete-bucket',
  uploadFileBucket = 'upload-file-bucket',
  uploadFolderBucket = 'upload-folder-bucket',
  createFolderBucket = 'create-folder-bucket',

  starterGuideStorage = 'starter-guide-storage',
  starterGuideStreaming = 'starter-guide-streaming',
  qrgenerationCasestudy = 'qrgeneration-casestudy',
  qrscannerCasestudy = 'qrscanner-casestudy',
  sdkGuideGame = 'sdk-guide-game',
  aiArticleBtn = 'ai-article-btn',

  repoCereDdcSdkJsBtn = 'repo-cere-ddc-sdk-js-btn',
}

export const gtagEvent = (eventId: GoogleAnalyticsId) => {
  window.dataLayer?.push({ event: eventId });
};
