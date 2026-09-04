// ⚠️ AI-GENERATED FILE — created with the assistance of Codebuff as part of
// the webpack → bun build migration. It is imported first by every page entry
// (see build.cjs) so node-style globals exist before app code runs.
//
// webpack 4's web-target build made node-style globals available to modules
// (Buffer, global, setImmediate/clearImmediate). bun's bundler does not
// inject those, and several node_modules packages (scratch-storage's
// BuiltinHelper, etc.) reference them bare. Import this module first in each
// entry so the globals exist before any app code runs.
import { Buffer } from "buffer";

const g = typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
        ? self
        : null;

if (g) {
    if (typeof g.Buffer === "undefined") g.Buffer = Buffer;
    if (typeof g.global === "undefined") g.global = g;
    if (typeof g.setImmediate === "undefined") {
        g.setImmediate = (fn, ...args) => setTimeout(() => fn(...args), 0);
        g.clearImmediate = id => clearTimeout(id);
    }
}
