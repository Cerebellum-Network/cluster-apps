import { makeAutoObservable, reaction } from 'mobx';
import Reporting from '@developer-console/reporting';

import { AccountStore } from '../AccountStore';
import { Quest } from './Quest';

export type QuestName = 'uploadFile';
export type QuestStep = 'createBucket' | 'fileUploaded';

export class QuestsStore {
  private questsMap = {
    uploadFile: new Quest<QuestStep>('uploadFile', ['createBucket', 'fileUploaded']),
  };

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    reaction(
      () => accountStore.address,
      (address) => {
        if (!address) {
          return this.questsMap.uploadFile.reset();
        }

        let parsedQuests: any = {};
        const storedQuests = localStorage.getItem(`dc:quests:${accountStore.address}`);

        try {
          parsedQuests = storedQuests ? JSON.parse(storedQuests) : {};
        } catch (e) {
          localStorage.removeItem(`dc:quests:${address}`);
        }

        if (parsedQuests.uploadFile) {
          this.questsMap.uploadFile.fromJson(parsedQuests.uploadFile);
          const uploadFileSteps = parsedQuests.uploadFileSteps || {};
          Object.keys(uploadFileSteps).forEach((step) => {
            const stepObj = this.questsMap.uploadFile.steps.find(({ name }) => name === step);
            if (stepObj) {
              stepObj.isDone = uploadFileSteps[step];
            }
          });
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

    const uploadFileSteps = this.questsMap.uploadFile.steps.reduce(
      (steps, step) => {
        steps[step.name] = step.isDone;
        return steps;
      },
      {} as Record<QuestStep, boolean>,
    );

    localStorage.setItem(
      `dc:quests:${this.accountStore.address}`,
      JSON.stringify({
        uploadFile: this.questsMap.uploadFile.toJson(),
        uploadFileSteps,
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
