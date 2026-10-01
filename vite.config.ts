// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Solana's packages (and rpc-websockets) only publish "browser" and "node"
// export conditions. The Cloudflare/workerd server build matches neither, so
// resolution fails. Point those bare specifiers at their browser ESM builds,
// which are dependency-free enough to run in the Worker runtime.
const BROWSER_BUILD_PKGS = /^(rpc-websockets|@solana\/(?!web3\.js$)[a-z0-9-]+)$/;

function solanaBrowserBuilds() {
  return {
    name: "biocode:solana-browser-builds",
    enforce: "pre" as const,
    resolveId(source: string, importer: string | undefined) {
      if (!BROWSER_BUILD_PKGS.test(source)) return null;
      let dir = importer ? path.dirname(importer) : root;
      for (let i = 0; i < 12; i += 1) {
        const candidate = path.join(dir, "node_modules", source, "dist", "index.browser.mjs");
        if (existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return null;
    },
  };
}

// @coral-xyz/anchor's ESM build assigns to the CommonJS `exports` global at
// module scope (`if (!isBrowser) { exports.workspace = ... }`). In the Worker
// runtime that throws `ReferenceError: exports is not defined` on every request.
// Strip the Node-only branch — workspace/nodewallet are never used here.
function anchorEsmNodeBranchFix() {
  return {
    name: "biocode:anchor-esm-node-branch",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.includes("@coral-xyz/anchor") || !id.endsWith("dist/esm/index.js")) return null;
      if (!code.includes("exports.workspace")) return null;
      return {
        code: code.replace(
          /if \(!isBrowser\) \{[\s\S]*?\n\}/,
          "// node-only workspace/nodewallet exports removed for Worker runtime",
        ),
        map: null,
      };
    },
  };
}

// In the browser build Vite externalizes the "buffer" builtin, so `Buffer`
// resolves to undefined and Solana code crashes with
// "Cannot read properties of undefined (reading 'from')".
// Point browser imports at the `buffer` npm polyfill instead.
function bufferBrowserPolyfill() {
  let isBuild = false;
  return {
    name: "biocode:buffer-browser-polyfill",
    enforce: "pre" as const,
    config(_config: unknown, env: { command: string }) {
      isBuild = env.command === "build";
    },
    resolveId(source: string, _importer: string | undefined, options?: { ssr?: boolean }) {
      // In dev, let Vite's dependency pre-bundling handle "buffer": resolving
      // straight to the CJS file there breaks named `Buffer` imports.
      if (!isBuild || options?.ssr) return null;
      if (source !== "buffer" && source !== "node:buffer") return null;
      const candidate = path.join(root, "node_modules", "buffer", "index.js");
      return existsSync(candidate) ? candidate : null;
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [solanaBrowserBuilds(), anchorEsmNodeBranchFix(), bufferBrowserPolyfill()],
    optimizeDeps: { include: ["buffer"] },
  },
});

