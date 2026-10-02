import { serverURL } from "./lib/server-url";

/** Runs once when the server starts: a production server without its address must not start. */
export function register() {
  serverURL();
}
