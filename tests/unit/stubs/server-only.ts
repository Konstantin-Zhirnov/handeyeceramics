/**
 * Stands in for the `server-only` package under vitest: the real one throws
 * outside a React Server Components bundle, and the unit tests import server
 * modules in plain Node. An empty module, like the package in the server layer.
 */
export {};
