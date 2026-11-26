// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import applications from '../../applications';
import Navigation from './Navigation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** The sidebar as a page at `url` shows it. */
const sidebar = (url: string) => {
  const host = document.createElement('div');
  const root = createRoot(host);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[url]}>
        <Navigation items={applications} />
      </MemoryRouter>,
    ),
  );
  const html = host.innerHTML;
  act(() => root.unmount());
  host.innerHTML = html;
  return host;
};

const link = (host: HTMLElement, path: string) => host.querySelector<HTMLAnchorElement>(`a[href="${path}"]`);

describe('Navigation', () => {
  it('shows Agents, after Sandboxes, with an "Exp" label that reads as Experimental', () => {
    const host = sidebar('/inference');
    const agents = link(host, '/agents');
    expect(agents).not.toBeNull();
    const labels = [...host.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(labels.indexOf('/agents')).toBe(labels.indexOf('/sandboxes') + 1);

    // Seen: "Agents" then "Exp"; heard: "Agents Experimental"; on hover: what experimental means.
    const shown = agents!.querySelector('span[aria-hidden="true"]');
    expect(shown?.textContent).toBe('Exp');
    const badge = shown!.parentElement!;
    expect(badge.getAttribute('title')).toBe('Experimental: this may still change.');
    const heard = [...badge.childNodes].filter((n) => !(n instanceof Element && n.getAttribute('aria-hidden')));
    expect(heard.map((n) => n.textContent).join('')).toBe('Experimental');
    expect(agents!.textContent).toBe('AgentsExpExperimental');
  });

  it('labels nothing else', () => {
    const host = sidebar('/inference');
    for (const a of host.querySelectorAll('a')) {
      if (a.getAttribute('href') === '/agents') continue;
      expect(a.textContent).not.toContain('Exp');
    }
  });

  it('is the same with the old ?experimental= parameter, which nothing reads any more', () => {
    for (const url of [
      '/inference?experimental=agents',
      '/access-tokens?experimental=agents',
      '/agents?experimental=off',
    ]) {
      const agents = link(sidebar(url), '/agents');
      expect(agents?.textContent).toBe('AgentsExpExperimental');
    }
  });
});
