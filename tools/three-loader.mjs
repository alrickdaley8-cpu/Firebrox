// Resolves bare `three` / `three/addons/*` imports to the vendored copy,
// so the smoke test runs with no npm install of three.
export function resolve(specifier, context, next) {
  if (specifier === 'three') {
    return { url: new URL('../vendor/three/three.module.js', import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith('three/')) {
    return { url: new URL('../vendor/' + specifier, import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
