/**
 * App tests — fixture for test file search and symbol lookup.
 */

import { App, createApp } from "../src/index";

function testAppCreation() {
  const app = createApp("test-app", true);
  if (app.getName() !== "test-app") throw new Error("Name mismatch");
  if (!app.isDebug()) throw new Error("Debug should be true");
}

function testConfig() {
  const app = createApp("prod-app", false);
  if (app.isDebug()) throw new Error("Debug should be false");
}

// Run tests
testAppCreation();
testConfig();
