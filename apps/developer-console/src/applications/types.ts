import { ReactNode, ComponentType } from 'react';

/** Sidebar grouping, from the mockup: core services vs the account area. */
export type AppGroup = 'services' | 'account';

/** A sub-page shown under an expanded sidebar item (e.g. Inference → Models…). */
export type SubNavItem = {
  /** Path relative to the app's `rootPath` (''=the index sub-route). */
  path: string;
  label: string;
  /** Stay highlighted on the item's child pages too (e.g. a list and its detail pages). */
  prefix?: boolean;
};

export type Application = {
  rootPath: string;
  rootComponent: ComponentType;
  title: string;
  /** Short label for the compact sidebar; falls back to `title`. */
  navLabel?: string;
  description: string;
  icon: ReactNode;
  /** Which sidebar group this app sits in. */
  group: AppGroup;
  /** Sub-navigation shown when the item is active. */
  subNav?: SubNavItem[];
  widget?: ReactNode;
};
