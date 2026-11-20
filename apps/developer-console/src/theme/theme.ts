import { createTheme as createBaseTheme } from '@cluster-apps/ui';

/**
 * Developer-console theme. The mockup is built on the shared @cluster-apps/ui
 * theme AS-IS (HumanSans, primary #5865F2, page background #F5F7FA, text #1D1B20,
 * 8px/36px buttons), so we use that theme unchanged rather than overriding its
 * palette, font or button shape (#192 review). Anything the shared theme doesn't
 * set is a per-component default and lives in the shared layout components
 * (PageHeader / Section / ComingSoon), not here, so pages can't drift.
 */
export const developerConsoleTheme = createBaseTheme();
