import { makeAutoObservable } from 'mobx';

type QuestStep<T> = { name: T; isDone: boolean }[];

export class Quest<T = string> {
  readonly steps: QuestStep<T>;

  isCompleted = false;
  isNotified = false;

  constructor(
    readonly name: string,
    steps: T[],
  ) {
    makeAutoObservable(this);

    this.steps = steps.map((name) => ({ name, isDone: false }));
  }

  reset() {
    this.isCompleted = false;
    this.isNotified = false;

    this.steps.forEach((step) => {
      step.isDone = false;
    });
  }

  toJson() {
    return {
      name: this.name,
      isCompleted: this.isCompleted,
      isNotified: this.isNotified,
      steps: this.steps.map((step) => ({
        name: step.name,
        isDone: step.isDone,
      })),
    };
  }

  fromJson(json: any) {
    this.isCompleted = !!json.isCompleted;
    this.isNotified = !!json.isNotified;
    if (json.steps && Array.isArray(json.steps)) {
      json.steps.forEach((savedStep: any) => {
        const step = this.steps.find(({ name }) => name === savedStep.name);
        if (step) {
          step.isDone = savedStep.isDone;
        }
      });
    }
  }
}
