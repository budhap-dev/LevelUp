import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Feature tests render real lazy routes and topic chunks; CI runners can take over a second to import them.
configure({ asyncUtilTimeout: 5000 });

// jsdom doesn't implement matchMedia.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
