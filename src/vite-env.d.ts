/// <reference types="vite/client" />

declare module '*.md' {
  const markdown: string;

  export { markdown };
}
