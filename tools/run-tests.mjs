// Entry point for `npm test`: registers the three resolver, then runs the smoke test.
import { register } from 'node:module';
register('./three-loader.mjs', import.meta.url);
await import('./smoke-test.mjs');
