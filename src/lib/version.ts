/** What's running: build date version (CalVer), short commit and build time (see `define` in vite.config.ts). */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILT_AT = new Date(__APP_BUILT_AT__);

export const versionLabel = `v${APP_VERSION} · ${APP_COMMIT}`;

export const builtAtLabel = APP_BUILT_AT.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
