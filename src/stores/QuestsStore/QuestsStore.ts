import { makeAutoObservable, reaction } from 'mobx';
import { AccountStore } from '../AccountStore';

type QuestName = 'uploadFile';
type Quest = {
  name: QuestName;
  isCompleted: boolean;
  isNotified: boolean;
};

export class QuestsStore {
  private questsMap: Record<QuestName, Quest> = {
    uploadFile: {
      isCompleted: false,
      isNotified: false,
      name: 'uploadFile',
    },
  };

  constructor(private accountStore: AccountStore) {
    makeAutoObservable(this);

    reaction(
      () => accountStore.address,
      (address) => {
        if (address) {
          const storedQuests = localStorage.getItem(`dc:quests:${accountStore.address}`);

          this.questsMap = storedQuests
            ? JSON.parse(storedQuests)
            : {
                uploadFile: {
                  isCompleted: false,
                  isNotified: false,
                  name: 'uploadFile',
                },
              };
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

    localStorage.setItem(`dc:quests:${this.accountStore.address}`, JSON.stringify(this.questsMap));
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
