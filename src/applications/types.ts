import { ReactNode, ComponentType } from 'react';

export type Application = {
  title: string;
  description: string;
  icon: ReactNode;
  rootPath: string;
  rootComponent: ComponentType;
};
