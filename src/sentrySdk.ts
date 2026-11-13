// Named re-exports so the lazy chunk tree-shakes to just what src/sentry.ts uses
// (a namespace `import('@sentry/browser')` pulls in replay, feedback, tracing…).
export { init, captureException } from '@sentry/browser';
