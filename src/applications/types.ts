import { ReactNode, ComponentType } from 'react';

export type Application = {
  rootPath: string;
  rootComponent: ComponentType;
  title: string;
  description: string;
  icon: ReactNode;
  widget?: ReactNode;
};
