// One official compatibility runtime in development, production and SSR tests.
// Exact matches keep subpath imports explicit; no rewriting dependency sources.
export const uiRuntimeAliases = [
  {find: /^react$/, replacement: 'preact/compat'},
  {find: /^react-dom$/, replacement: 'preact/compat'},
  {find: /^react-dom\/client$/, replacement: 'preact/compat/client'},
  {find: /^react-dom\/server$/, replacement: 'preact/compat/server'},
  {find: /^react\/jsx-runtime$/, replacement: 'preact/compat/jsx-runtime'},
  {find: /^react\/jsx-dev-runtime$/, replacement: 'preact/compat/jsx-dev-runtime'},
];
