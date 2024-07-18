Project file structure
===

The root level project structure consists of two important directories:
- `src/` - the source code folder of the application
- `packages/` - general purpose packages


## Source folder (`/src`)
This folder contains the main application source code including business and UI logic.

- `routes/`  
Components responsible of presenting entire screens of the application. Routes are also responsible of connecting components to stores.

- `components/`  
Reusable components which are used by routes to compose screens UI. The difference between these components and the ones from `UI Kit` is that these components are aware of the application store and can subscribe to its changes.

- `stores/`  
Stores (MobX) are responsible of managing the application state according to the business rules. It is the business layer of the application with no direct connection to UI elements.

- `applications/`
Applications are sections of the Developer Console focused on particular DDC usa-cases.


## General purpose packages (`/packages`)
This folder contains variety of local npm packages (`Monorepo`) each with its own goal, responsibility and dependencies. The main application can depend on these packages. The packages can also depend on each other (except circular dependencies).  
An example of such general purpose package is `UI Kit` (`@developer-console/ui`) package. Its only purpose is to provide a reusable set of UI building blocks.