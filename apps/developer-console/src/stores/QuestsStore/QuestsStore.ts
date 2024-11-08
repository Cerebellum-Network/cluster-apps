import { makeAutoObservable, reaction } from 'mobx';
import Reporting from '@cluster-apps/reporting';

import { AccountStore } from '../AccountStore';
import { Quest } from './Quest';

export type QuestName = 'uploadFile' | 'createBucket' | 'addTokens';
export type QuestStep = 'createBucket' | 'startUploading' | 'startCreating' | 'bucketCreated' | 'addTokens';

export class QuestsStore {
  private questsMap = {
    addTokens: new Quest<QuestStep>('addTokens', ['addTokens']),
    uploadFile: new Quest<QuestStep>('uploadFile', ['createBucket', 'startUploading', 'addTokens']),
    createBucket: new Quest<QuestStep>('createBucket', ['bucketCreated', 'startCreating']),
  };

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    reaction(
      () => accountStore.address,
      (address) => {
        if (!address) {
          this.questsMap.addTokens.reset();
          this.questsMap.createBucket.reset();
          this.questsMap.uploadFile.reset();
          return;
        }

        let parsedQuests: any = {};
        const storedQuests = localStorage.getItem(`dc:quests:${accountStore.address}`);

        try {
          parsedQuests = storedQuests ? JSON.parse(storedQuests) : {};
        } catch (e) {
          localStorage.removeItem(`dc:quests:${address}`);
        }
        if (parsedQuests.addTokens) {
          this.questsMap.addTokens.fromJson(parsedQuests.addTokens);
        } else {
          this.questsMap.addTokens.reset();
        }

        if (parsedQuests.uploadFile) {
          this.questsMap.uploadFile.fromJson(parsedQuests.uploadFile);
        } else {
          this.questsMap.uploadFile.reset();
        }
      },
    );
  }

  get quests() {
    return Object.values(this.questsMap);
  }

  private storeQuests() {
    if (!this.accountStore.address) {
      return;
    }

    localStorage.setItem(
      `dc:quests:${this.accountStore.address}`,
      JSON.stringify({
        uploadFile: this.questsMap.uploadFile.toJson(),
        createBucket: this.questsMap.createBucket.toJson(),
        addTokens: this.questsMap.addTokens.toJson(),
      }),
    );
  }

  isStepDone(quest: QuestName, step: QuestStep) {
    if (this.questsMap[quest].isCompleted) {
      return true;
    }

    return this.questsMap[quest].steps.some(({ name, isDone }) => name === step && isDone);
  }

  markStepDone(quest: QuestName, step: QuestStep) {
    const stepObj = this.questsMap[quest].steps.find(({ name }) => name === step);

    if (stepObj) {
      stepObj.isDone = true;
      this.storeQuests();

      Reporting.message(`Quest step ${quest}:${step} is done`, 'info', { event: 'questStepDone' });
    }
  }

  isCompleted(quest: QuestName) {
    return this.questsMap[quest].isCompleted;
  }

  isNotified(quest: QuestName) {
    return this.questsMap[quest].isNotified;
  }

  markCompleted(quest: QuestName, isCompleted = true) {
    this.questsMap[quest].isCompleted = isCompleted;
    this.storeQuests();

    if (isCompleted) {
      Reporting.message(`Quest ${quest} is completed`, 'info', { event: 'questCompleted' });
    }
  }

  markNotified(quest: QuestName, isNotified = true) {
    this.questsMap[quest].isNotified = isNotified;
    this.storeQuests();
  }
}
