import { makeAutoObservable, reaction } from 'mobx';
import { AccountStore } from '../AccountStore';
import { Quest } from './Quest';

export type QuestName = 'uploadFile';
export type QuestStep = 'createBucket' | 'startUploading';

export class QuestsStore {
  private questsMap = {
    uploadFile: new Quest<QuestStep>('uploadFile', ['createBucket', 'startUploading']),
  };

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    reaction(
      () => accountStore.address,
      (address) => {
        if (!address) {
          return;
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
  }

  markNotified(quest: QuestName, isNotified = true) {
    this.questsMap[quest].isNotified = isNotified;

    this.storeQuests();
  }
}
