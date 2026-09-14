import { test, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";

globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  clearTimeout() {},
  setTimeout() { return 1; },
  location: { href: "https://vocab-lemon.vercel.app" },
  history: { pushState() {} },
};

globalThis.document = {
  fullscreenElement: null,
  addEventListener() {},
  removeEventListener() {},
};

import { App } from "./App";

test("App renders without crashing", () => {
  const html = renderToString(<App />);
  expect(html).toBeTruthy();
});
