#!/usr/bin/env bun
/**
 * ============================================================================
 * ⚠️  AI-GENERATED FILE
 * ============================================================================
 * This file was created with the assistance of Codebuff (an AI coding agent)
 * as a drop-in replacement for the removed webpack.config.js of the online
 * editor. It is hand-maintained build tooling — treat it as real source code,
 * not throwaway output.
 *
 * It lives at the repository root (outside online-editor/) and builds the
 * online editor in place. All build dependencies (postcss, loader-utils, …)
 * are resolved from online-editor/node_modules via createRequire, so it works
 * no matter where it is invoked from.
 * ============================================================================
 */

/**
 * Bun-based replacement for the webpack build of the online editor.
 *
 * Reproduces what webpack.config.js used to do:
 *  - Bundles the playground entries (editor/playground/player/fullscreen/embed/
 *    addon-settings/credits) into online-editor/build/js/ as ES modules
 *  - Emulates the old loader chain for CSS: style-loader + css-loader(modules,
 *    camelCase) + postcss(import, vars, autoprefixer) for plain `.css` imports,
 *    and the `!css-loader!` / `!url-loader!` / `!raw-loader!` /
 *    `!base64-loader!` / `!arraybuffer-loader!` / `!ify-loader!` /
 *    `worker-loader` prefixed imports used across scratch-* and the addon system
 *  - Copies assets to static/assets/ and rewrites url()/import references
 *  - Copies the static/ folder, scratch-blocks media and example extensions
 *  - Renders the EJS HTML templates with the right <script> tags
 *  - Generates sw.js with the HTML/lazy asset lists filled in
 *
 * Usage:
 *   bun build.cjs                        one-shot build (dev, unminified)
 *   bun build.cjs --production           minified build
 *   bun build.cjs --watch                rebuild when sources change
 *   bun build.cjs --serve                serve ./build on a port (default 3000)
 *   bun build.cjs --only editor          build a single entry (debugging)
 *
 * From online-editor/ (e.g. via `npm run build`) it is invoked as
 * `bun run ../build.cjs`.
 */

const { build: bunBuild } = require("bun");
const crypto = require("node:crypto");
const { mkdir, readFile, readdir, rm, writeFile, cp, stat } = require("node:fs/promises");
const { existsSync, readFileSync, statSync, watch, writeFileSync } = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");

// ---------------------------------------------------------------------------
// Paths & configuration
// ---------------------------------------------------------------------------

// This script lives at the repository root; the editor it builds is the
// online-editor/ subdirectory. ROOT_DIR is the webpack rootContext the old
// build used, so CSS-module hashes stay byte-identical (see scopedName).
const ROOT_DIR = path.join(__dirname);

// Resolve build dependencies from online-editor/node_modules (the package.json
// of the editor), not from the repository root, because require() resolves
// relative to this file's location.
const editorRequire = createRequire(path.join(ROOT_DIR, "package.json"));
const postcss = editorRequire("postcss");
const postcssImport = editorRequire("postcss-import");
const postcssVars = editorRequire("postcss-simple-vars");
const autoprefixer = editorRequire("autoprefixer");
const postcssModules = editorRequire("postcss-modules");
// loader-utils@1.x — the exact hashing css-loader 1.0.1 used. Its `base64`
// digest is a big-number encoding (big.js), which differs from both standard
// base64 and a naive BigInt conversion, so use the real package instead of
// reimplementing it.
const loaderUtils = editorRequire("loader-utils");

const SRC_DIR = path.join(ROOT_DIR, "src");
const STATIC_DIR = path.join(ROOT_DIR, "static");
const OUT_DIR = path.join(ROOT_DIR, "build");
const JS_DIR = path.join(OUT_DIR, "js");
const ASSETS_DIR = path.join(OUT_DIR, "static", "assets");
const EXTENSION_WORKER_DIR = path.join(JS_DIR, "extension-worker");
const TMP_BUILD_DIR = path.join(OUT_DIR, ".tmp-worker");

const args = process.argv.slice(2);
const isProduction = args.includes("--production") || process.env.NODE_ENV === "production";
const isWatch = args.includes("--watch");
const isServe = args.includes("--serve");
const onlyIndex = args.indexOf("--only");
const onlyEntries = onlyIndex === -1 ? [] : args.slice(onlyIndex + 1).filter(a => !a.startsWith("--"));

const root = process.env.ROOT || "";

// Same entry set as webpack.config.js (entry basenames become js/<entry>.js).
const PAGES = [
    { entry: "editor", file: "editor.html", template: "index.ejs", title: "PenguinMod - Editor" },
    { entry: "playground", file: "playground.html", template: "index.ejs", title: "PenguinMod - Playground" },
    { entry: "player", file: "index.html", template: "index.ejs", title: "PenguinMod - A mod of TurboWarp" },
    { entry: "fullscreen", file: "fullscreen.html", template: "index.ejs", title: "PenguinMod - A mod of TurboWarp" },
    { entry: "embed", file: "embed.html", template: "index.ejs", title: "Embedded Project - PenguinMod", noTheme: true },
    { entry: "addon-settings", file: "addons.html", template: "simple.ejs", title: "Addon Settings - PenguinMod" },
    { entry: "credits", file: "credits.html", template: "simple.ejs", title: "PenguinMod & TurboWarp Credits", noSplash: true }
];

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json"
};

const toPlatformPath = p => {
    if (typeof p !== "string") return p;
    let result = p.replace(/^\/(?=[A-Za-z]:)/, "");
    if (process.platform === "win32") result = result.replace(/\//g, "\\");
    return result;
};
const toUrlPath = p => p.replace(/\\/g, "/");

const contentHash = bytes => crypto.createHash("sha1").update(bytes).digest("hex").slice(0, 12);

const uniqueModuleId = file => `css!${toUrlPath(path.relative(ROOT_DIR, file))}`;

// ---------------------------------------------------------------------------
// Asset handling (webpack file-loader -> static/assets/<hash>.<ext>)
// ---------------------------------------------------------------------------

const ASSET_EXTENSIONS = [
    "svg", "png", "wav", "gif", "jpg", "jpeg", "mp3", "ttf", "otf", "ico", "webp", "mp4", "woff", "woff2"
];

const copiedAssets = new Map(); // source path -> relative url
const assetFileQueue = []; // {srcPath, destName}

function assetUrlFor(srcPath) {
    if (copiedAssets.has(srcPath)) return copiedAssets.get(srcPath);
    const bytes = readFileSync(srcPath);
    const ext = path.extname(srcPath).slice(1);
    const name = `${contentHash(bytes)}.${ext}`;
    copiedAssets.set(srcPath, `static/assets/${name}`);
    assetFileQueue.push({ srcPath, destName: name });
    return `static/assets/${name}`;
}

async function flushAssets() {
    if (assetFileQueue.length === 0) return;
    await mkdir(ASSETS_DIR, { recursive: true });
    for (const { srcPath, destName } of assetFileQueue) {
        const dest = path.join(ASSETS_DIR, destName);
        if (!existsSync(dest)) await writeFile(dest, await readFile(srcPath));
    }
    assetFileQueue.length = 0;
}

// ---------------------------------------------------------------------------
// PostCSS: imports, $vars, autoprefixer, url() rewriting, css modules
// ---------------------------------------------------------------------------

// Rewrites url(...) references to static/assets/<hash>.<ext> (file-loader).
function rewriteCssUrl(rawUrl, cssFile) {
    let url = rawUrl.trim();
    if (!url || url.startsWith("data:") || url.startsWith("#") || url.includes("${")) return null;
    if (/^https?:/.test(url) || url.startsWith("//") || url.startsWith("/")) return null;
    let suffix = "";
    const cut = Math.min(...["#", "?"].map(c => url.indexOf(c)).filter(i => i !== -1));
    if (cut !== -1 && cut !== Infinity) {
        suffix = url.slice(cut);
        url = url.slice(0, cut);
    }
    if (!url) return null;
    const srcPath = path.resolve(path.dirname(cssFile), url);
    if (!existsSync(srcPath)) return null;
    return assetUrlFor(srcPath) + suffix;
}

const cssUrlRewritePlugin = () => ({
    postcssPlugin: "bun-css-url-rewrite",
    Declaration(decl) {
        const from = decl.source && decl.source.input && decl.source.input.file;
        if (!from) return;
        decl.value = decl.value.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/g, (match, _quote, inner) => {
            const rewritten = rewriteCssUrl(inner, from);
            return rewritten === null ? match : `url(${rewritten})`;
        });
    }
});

// Reproduces css-loader 1.0.1's getLocalIdent exactly (it ran with
// localIdentName `[name]_[local]_[hash:base64:5]`): the hash is md5 of
// `<rootContext-relative request>+<localName>` encoded with loader-utils'
// big-number base64, truncated to 5 chars. webpack's dev output used this, and
// the desktop injector (src-tauri domModifier, baked into script.js) locates
// DOM nodes via these exact hashed class names — so they MUST stay identical.
const scopedName = (name, file) => {
    const cleanFile = toPlatformPath(file);
    const base = path.basename(cleanFile).replace(/\.[^.]+$/, "");
    const request = path.relative(ROOT_DIR, cleanFile);
    const shortHash = loaderUtils.getHashDigest(`${request}+${name}`, "md5", "base64", 5);
    return `${base}_${name}_${shortHash}`;
};

// webpack loader order (right-to-left): postcss-loader -> css-loader -> style-loader
async function processModuleCss(file) {
    const source = readFileSync(file, "utf8");
    // stage 1: postcss-import, postcss-simple-vars, autoprefixer, url rewrite
    const stage1 = await postcss([
        postcssImport({ root: ROOT_DIR }),
        postcssVars(),
        autoprefixer(),
        cssUrlRewritePlugin()
    ]).process(source, { from: file });
    // stage 2: css modules (ICSS). Kept in its own processor because
    // postcss-modules re-runs the plugins that precede it internally.
    let tokens = {};
    const stage2 = await postcss([
        postcssModules({
            generateScopedName: (name, filename) => scopedName(name, filename),
            localsConvention: "camelCase",
            getJSON: (_file, json) => {
                tokens = json;
            }
        })
    ]).process(stage1.css, { from: file });
    return { css: stage2.css, tokens };
}

// `!css-loader!./x.css` (addon styles): css-loader alone, no modules, no style-loader
async function processGlobalCss(file) {
    const source = readFileSync(file, "utf8");
    const result = await postcss([
        postcssImport({ root: ROOT_DIR }),
        cssUrlRewritePlugin()
    ]).process(source, { from: file });
    return result.css;
}

// css-loader module-list shape [[moduleId, cssText, ""]] consumed by the addons
function cssListModule(moduleId, cssText) {
    return (
        `const list = [[${JSON.stringify(moduleId)}, ${JSON.stringify(cssText)}, ""]];\n` +
        `module.exports = list;\n`
    );
}

// style-loader semantics: inject css at runtime + re-export locals map
function styleModule(cssText, locals) {
    const pairs = Object.entries(locals).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
    return (
        `const css = ${JSON.stringify(cssText)};\n` +
        `if (typeof document !== "undefined") {\n` +
        `    const style = document.createElement("style");\n` +
        `    style.textContent = css;\n` +
        `    (document.head || document.documentElement).appendChild(style);\n` +
        `}\n` +
        `const locals = {${pairs.join(",")}};\n` +
        `module.exports = locals;\n`
    );
}

// ---------------------------------------------------------------------------
// Webpack loader shims (`!raw-loader!x`, `worker-loader?...!x`, etc.)
// ---------------------------------------------------------------------------

// Matches ESM `'!raw-loader!x'` style AND CJS `require('raw-loader!x')` style
// webpack loader requests. Import specifiers never legitimately contain "!"
// otherwise, so anything with one is a webpack loader chain.
const LOADER_IMPORT_RE = /!/;

function parseLoaderSpecifier(specifier) {
    const tokens = specifier.split("!").filter(Boolean);
    return { loaders: tokens.slice(0, -1), resource: tokens[tokens.length - 1] };
}

function resolveResource(resource, importer) {
    const fromDir = path.dirname(toPlatformPath(importer));
    try {
        return Bun.resolveSync(resource, fromDir);
    } catch {
        // fall back for cases Bun.resolveSync refuses (e.g. resource already absolute)
        if (path.isAbsolute(resource)) return toPlatformPath(resource);
        return path.resolve(fromDir, toPlatformPath(resource));
    }
}

// brfs replacements for the two packages scratch-render pulls in through
// `!ify-loader!` (browserify transform loader). Only used in those files.
const BRFS_DATA = new Map([
    [
        "grapheme-breaker",
        {
            file: "node_modules/grapheme-breaker/src/GraphemeBreaker.js",
            dataFile: "node_modules/grapheme-breaker/src/classes.trie",
            readPattern: /fs\.readFileSync\(\s*__dirname\s*\+\s*['"]\/classes\.trie['"]\s*\)/g,
            requireLine: /^\s*fs\s*=\s*require\(['"]fs['"]\);\s*$/m,
            replacement: b64 => `Uint8Array.from(atob("${b64}"), c => c.charCodeAt(0))`
        }
    ],
    [
        "linebreak",
        {
            file: "node_modules/linebreak/src/linebreaker.js",
            dataFile: "node_modules/linebreak/src/classes.trie",
            readPattern: /fs\.readFileSync\(\s*__dirname\s*\+\s*['"]\/classes\.trie['"]\s*,\s*['"]base64['"]\s*\)/g,
            requireLine: /^\s*fs\s*=\s*require\(['"]fs['"]\);\s*$/m,
            replacement: b64 => `"${b64}"`
        }
    ]
]);

function applyBrfsIfNeeded(file, source) {
    const rel = toUrlPath(path.relative(ROOT_DIR, file));
    for (const [name, spec] of BRFS_DATA) {
        if (rel.endsWith(spec.file)) {
            const dataPath = path.join(ROOT_DIR, spec.dataFile);
            const b64 = readFileSync(dataPath).toString("base64");
            source = source.replace(spec.readPattern, spec.replacement(b64));
            source = source.replace(spec.requireLine, "");
            return { source, name };
        }
    }
    return { source, name: null };
}

// Known worker-loader requests in the dependency graph. Pre-built before the
// main bundle (Bun.build cannot be safely nested inside a plugin callback).
const WORKER_REQUESTS = [
    {
        name: "scratch-vm extension worker",
        file: "node_modules/scratch-vm/src/extension-support/extension-worker.js",
        output: "file"
    },
    {
        name: "scratch-storage fetch worker",
        file: "node_modules/scratch-storage/src/FetchWorkerTool.worker.js",
        output: "inline"
    }
];

const workerArtifacts = new Map(); // platform file path -> {type, url?, source?}

// Build a single worker file to an iife bundle and return its bytes.
async function bundleWorker(file) {
    await mkdir(TMP_BUILD_DIR, { recursive: true });
    const result = await bunBuild({
        entrypoints: [toUrlPath(file)],
        outdir: toUrlPath(TMP_BUILD_DIR),
        format: "iife",
        target: "browser",
        minify: isProduction,
        define: webpackDefines,
        plugins: [aliasPlugin, eventsPlugin, legacyEsModulePlugin]
    });
    if (!result.success) {
        throw new Error(`worker sub-build failed for ${file}: ${JSON.stringify(result.logs)}`);
    }
    const outFile = result.outputs.find(o => o.kind === "entry-point");
    if (!outFile) throw new Error(`worker sub-build produced no output for ${file}`);
    return readFile(toPlatformPath(outFile.path));
}

async function prepareWorkers() {
    // scratch-vm sandboxed extensions run in a real worker file.
    {
        const file = path.join(ROOT_DIR, "node_modules/scratch-vm/src/extension-support/extension-worker.js");
        const bytes = await bundleWorker(file);
        const hash = contentHash(bytes);
        const name = `extension-worker.${hash}.js`;
        await mkdir(EXTENSION_WORKER_DIR, { recursive: true });
        await writeFile(path.join(EXTENSION_WORKER_DIR, name), bytes);
        workerArtifacts.set(toPlatformPath(file), { type: "file", url: `js/extension-worker/${name}` });
        console.log(`prepared worker: extension worker (${name})`);
    }
    // scratch-storage's fetch worker is inlined as a blob.
    {
        const file = path.join(ROOT_DIR, "node_modules/scratch-storage/src/FetchWorkerTool.worker.js");
        const bytes = await bundleWorker(file);
        workerArtifacts.set(toPlatformPath(file), { type: "inline", source: bytes.toString("utf8") });
        console.log("prepared worker: scratch-storage fetch worker (inline)");
    }
    // The iframe sandbox worker is inlined as *text* by the custom
    // `tw-load-script-as-plain-text` loader.
    {
        const file = path.join(ROOT_DIR, "node_modules/scratch-vm/src/extension-support/tw-iframe-extension-worker-entry.js");
        const bytes = await bundleWorker(file);
        iframeWorkerTexts.set(toPlatformPath(file), bytes.toString("utf8"));
        console.log("prepared worker: iframe extension worker (text)");
    }
    await rm(TMP_BUILD_DIR, { recursive: true, force: true });
}

const iframeWorkerTexts = new Map(); // platform path of the entry -> bundled source text

// Shared plugin factory: one namespace per webpack loader so onLoad never has
// to guess which loader a file was requested with.
const loaderNamespaces = {
    "raw-loader": "bun-loader-raw",
    "base64-loader": "bun-loader-base64",
    "arraybuffer-loader": "bun-loader-arraybuffer",
    "url-loader": "bun-loader-url",
    "css-loader": "bun-loader-css",
    "ify-loader": "bun-loader-ify",
    "file-loader": "bun-loader-file",
    "tw-load-script-as-plain-text": "bun-loader-plain-text"
};

const loaderShimPlugin = {
    name: "bun-loader-shim",
    setup(build) {
        build.onResolve({ filter: LOADER_IMPORT_RE }, args => {
            if (!args.path.includes("!")) return;
            if (args.path.startsWith("worker-loader")) return; // separate plugin
            const { loaders, resource } = parseLoaderSpecifier(args.path);
            if (loaders.length !== 1) {
                throw new Error(`Unsupported loader chain: ${args.path}`);
            }
            const loader = loaders[0].split("?")[0];
            // Custom loader referenced by path: `./tw-load-script-as-plain-text!./x`
            let file;
            let namespace;
            const loaderBasename = path.basename(toPlatformPath(loader));
            if (loaderBasename === "tw-load-script-as-plain-text") {
                const importerDir = path.dirname(toPlatformPath(args.importer));
                let loaderFile = path.isAbsolute(loader)
                    ? toPlatformPath(loader)
                    : path.resolve(importerDir, toPlatformPath(loader));
                if (!existsSync(loaderFile) && path.extname(loaderFile) === "" && existsSync(`${loaderFile}.js`)) {
                    loaderFile = `${loaderFile}.js`;
                }
                if (!existsSync(loaderFile)) throw new Error(`Cannot resolve loader ${loader}`);
                const entry = Bun.resolveSync("./tw-iframe-extension-worker-entry", path.dirname(loaderFile));
                if (!existsSync(entry)) throw new Error(`Cannot resolve iframe worker entry from ${loaderFile}`);
                file = toPlatformPath(entry);
                namespace = "bun-loader-plain-text";
            } else {
                namespace = loaderNamespaces[loader];
                if (!namespace) throw new Error(`Unsupported webpack loader: ${loader}`);
                file = resolveResource(resource, args.importer);
                if (!existsSync(file)) {
                    throw new Error(`Cannot resolve ${args.path} from ${args.importer}`);
                }
            }
            return { path: toUrlPath(file), namespace };
        });

        const onLoadHandler = async args => {
            const file = toPlatformPath(args.path);
            const namespace = args.namespace;
            if (namespace === loaderNamespaces["raw-loader"]) {
                const text = readFileSync(file, "utf8");
                return { loader: "js", contents: `module.exports = ${JSON.stringify(text)};` };
            }
            if (namespace === loaderNamespaces["base64-loader"]) {
                const b64 = readFileSync(file).toString("base64");
                return { loader: "js", contents: `module.exports = ${JSON.stringify(b64)};` };
            }
            if (namespace === loaderNamespaces["arraybuffer-loader"]) {
                // webpack's arraybuffer-loader emits `module.exports = toArrayBuffer(base64)`
                // evaluated at require time, so require() yields an ArrayBuffer.
                const b64 = readFileSync(file).toString("base64");
                return {
                    loader: "js",
                    contents:
                        `const bin = atob(${JSON.stringify(b64)});\n` +
                        `const bytes = new Uint8Array(bin.length);\n` +
                        `for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);\n` +
                        `module.exports = bytes.buffer;\n`
                };
            }
            if (namespace === loaderNamespaces["url-loader"]) {
                const bytes = readFileSync(file);
                const url = assetUrlFor(file);
                const finalUrl = bytes.byteLength <= 8192
                    ? `data:${mimeFor(file)};base64,${bytes.toString("base64")}`
                    : url;
                return { loader: "js", contents: `module.exports = ${JSON.stringify(finalUrl)};` };
            }
            if (namespace === loaderNamespaces["css-loader"]) {
                const css = await processGlobalCss(file);
                return { loader: "js", contents: cssListModule(uniqueModuleId(file), css) };
            }
            if (namespace === loaderNamespaces["file-loader"]) {
                // `!!file-loader?name=sw.js!./service-worker.js` — sw.js is
                // generated by this build script.
                return { loader: "js", contents: `module.exports = ${JSON.stringify("sw.js")};` };
            }
            if (namespace === loaderNamespaces["ify-loader"]) {
                let source = readFileSync(file, "utf8");
                source = applyBrfsIfNeeded(file, source).source;
                return { loader: "js", contents: source };
            }
            if (namespace === loaderNamespaces["tw-load-script-as-plain-text"]) {
                const source = iframeWorkerTexts.get(file);
                if (source === undefined) {
                    throw new Error(`No iframe worker text prepared for ${file}`);
                }
                return { loader: "js", contents: `module.exports = ${JSON.stringify(source)};` };
            }
            throw new Error(`Unknown loader namespace: ${namespace}`);
        };
        for (const ns of Object.values(loaderNamespaces)) {
            build.onLoad({ filter: /.*/, namespace: ns }, onLoadHandler);
        }
    }
};



function mimeFor(file) {
    switch (path.extname(file).toLowerCase()) {
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    case ".jpg": case ".jpeg": return "image/jpeg";
    case ".gif": return "image/gif";
    case ".wav": return "audio/wav";
    case ".mp3": return "audio/mpeg";
    case ".ico": return "image/x-icon";
    case ".ttf": return "font/ttf";
    case ".otf": return "font/otf";
    case ".webp": return "image/webp";
    default: return "application/octet-stream";
    }
}

// ---------------------------------------------------------------------------
// Bun plugins
// ---------------------------------------------------------------------------

// scratch-vm destructures `SyntheticModule` from the Node 'vm' module but never
// uses it; webpack resolved core modules as empty objects. Provide the same stub.
const nodeStubPlugin = {
    name: "bun-node-stubs",
    setup(build) {
        for (const mod of ["vm", "fs", "path"]) {
            build.onResolve({ filter: new RegExp(`^${mod}$`) }, args => {
                if (args.kind === "entry-point") return;
                return { path: toUrlPath(path.join(ROOT_DIR, "node_modules", ".bun-stub", `${mod}.js`)), namespace: "bun-node-stub" };
            });
        }
        build.onLoad({ filter: /\.js$/, namespace: "bun-node-stub" }, () => ({
            loader: "js",
            contents: `module.exports = {};`
        }));
    }
};

// react-virtualized has vestigial flow-type imports (`bpfrpt_proptype_*`) that
// webpack silently dropped but bun rejects. Remove them when the name is unused
// in the importing file.
const flowTypeStubPlugin = {
    name: "bun-flowtype-cleanup",
    setup(build) {
        build.onResolve({ filter: /onScroll/ }, args => {
            if (args.kind === "entry-point") return;
            let file;
            try {
                file = Bun.resolveSync(args.path, path.dirname(toPlatformPath(args.importer)));
            } catch {
                return;
            }
            const rel = toUrlPath(path.relative(ROOT_DIR, file));
            if (rel.includes("react-virtualized/dist/es/") && rel.endsWith("utils/onScroll.js")) {
                return { path: toUrlPath(file), namespace: "bun-flowtype-cleanup" };
            }
        });
        build.onLoad({ filter: /\.js$/, namespace: "bun-flowtype-cleanup" }, args => {
            const file = toPlatformPath(args.path);
            let source = readFileSync(file, "utf8");
            const before = source;
            source = source.replace(
                /^import \{ bpfrpt_proptype_\w+ \} from '[^']*';[\r\n]*/gm,
                ""
            );
            if (source !== before) {
                console.log(`flowtype-cleanup: stripped vestigial import in ${path.basename(file)}`);
            }
            return { loader: "js", contents: source };
        });
    }
};

const assetPlugin = {
    name: "bun-assets",
    setup(build) {
        const pattern = new RegExp(`\\.(${ASSET_EXTENSIONS.join("|")})$`);
        build.onResolve({ filter: pattern }, args => {
            if (args.kind === "entry-point") return;
            if (LOADER_IMPORT_RE.test(args.path)) return;
            const fromDir = path.dirname(toPlatformPath(args.importer));
            let file = path.resolve(fromDir, toPlatformPath(args.path));
            if (!existsSync(file)) {
                // Bare package specifier pointing at an asset inside node_modules.
                try {
                    file = toPlatformPath(Bun.resolveSync(args.path, fromDir));
                } catch {
                    return;
                }
            }
            return { path: toUrlPath(file), namespace: "bun-asset" };
        });
        build.onLoad({ filter: /.*/, namespace: "bun-asset" }, args => {
            const url = assetUrlFor(toPlatformPath(args.path));
            return { loader: "js", contents: `module.exports = ${JSON.stringify(url)};` };
        });
    }
};

const cssModulePlugin = {
    name: "bun-css",
    setup(build) {
        build.onResolve({ filter: /\.css$/ }, args => {
            if (args.kind === "entry-point") return;
            if (LOADER_IMPORT_RE.test(args.path)) return;
            const fromDir = path.dirname(toPlatformPath(args.importer));
            let file = path.resolve(fromDir, toPlatformPath(args.path));
            if (!existsSync(file)) {
                // Bare package specifier (e.g. `react-tabs/style/react-tabs.css`):
                // resolve through node_modules so it goes through the same
                // module pipeline instead of bun's native css emission.
                try {
                    file = toPlatformPath(Bun.resolveSync(args.path, fromDir));
                } catch {
                    return;
                }
            }
            return { path: toUrlPath(file), namespace: "bun-css-file" };
        });
        build.onLoad({ filter: /.*/, namespace: "bun-css-file" }, async args => {
            const { css, tokens } = await processModuleCss(toPlatformPath(args.path));
            return { loader: "js", contents: styleModule(css, tokens) };
        });
    }
};

const workerLoaderPlugin = {
    name: "bun-worker-loader",
    setup(build) {
        build.onResolve({ filter: /^worker-loader/ }, args => {
            const { resource } = parseLoaderSpecifier(args.path);
            const file = resolveResource(resource, args.importer);
            if (!existsSync(file)) throw new Error(`worker-loader: cannot resolve ${resource}`);
            return { path: toUrlPath(file), namespace: "bun-worker" };
        });
        build.onLoad({ filter: /.*/, namespace: "bun-worker" }, async args => {
            const file = toPlatformPath(args.path);
            const artifact = workerArtifacts.get(file);
            if (!artifact) {
                throw new Error(`worker-loader: no pre-built artifact for ${file}`);
            }
            if (artifact.type === "inline") {
                return {
                    loader: "js",
                    contents:
                        `const source = ${JSON.stringify(artifact.source)};\n` +
                        `let workerUrl;\n` +
                        `module.exports = class BunInlineWorker {\n` +
                        `    constructor() {\n` +
                        `        if (!workerUrl) {\n` +
                        `            workerUrl = URL.createObjectURL(new Blob([source], {type: "text/javascript"}));\n` +
                        `        }\n` +
                        `        return new Worker(workerUrl);\n` +
                        `    }\n` +
                        `}\n`
                };
            }
            return {
                loader: "js",
                contents:
                    `const workerUrl = ${JSON.stringify(artifact.url)};\n` +
                    `module.exports = class BunFileWorker {\n` +
                    `    constructor() {\n` +
                    `        return new Worker(workerUrl);\n` +
                    `    }\n` +
                    `}\n`
            };
        });
    }
};

const webpackAliases = {
    "text-encoding": toUrlPath(path.join(SRC_DIR, "lib", "tw-text-encoder.js")),
    "scratch-render-fonts": toUrlPath(path.join(SRC_DIR, "lib", "tw-scratch-render-fonts")),
    // Pin @turbowarp/scratch-l10n to its pure-ESM src, exactly like webpack
    // resolved it via the package.json `browser` field. Allowing bun's
    // default resolution to fall through to the CJS webpack bundle
    // (dist/l10n.js) routes named exports through a fragile `.default`
    // interop wrapper; when that wrapper is the `locales` map (not the
    // module namespace), `isRtl` reads as undefined and runtime calls throw
    // "isRtl is not a function". The ESM src binds named exports directly.
    "@turbowarp/scratch-l10n": toUrlPath(path.join(ROOT_DIR, "node_modules", "@turbowarp", "scratch-l10n", "src", "index.js"))
};

// webpack `resolve.alias` entries. bun's `alias` build option is silently
// ignored by this bun version, so enforce the mapping in a plugin (otherwise
// `scratch-render-fonts` falls through to the npm package, whose module shape
// differs and breaks runtime code that expects `loadFonts`).
const aliasPlugin = {
    name: "bun-webpack-alias",
    setup(build) {
        for (const [specifier, target] of Object.entries(webpackAliases)) {
            const filter = new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
            build.onResolve({ filter }, args => {
                if (args.kind === "entry-point") return;
                let file = toPlatformPath(target);
                if (!path.isAbsolute(file)) file = path.resolve(ROOT_DIR, file);
                if (existsSync(file) && statSync(file).isDirectory()) {
                    const idx = path.join(file, "index.js");
                    if (existsSync(idx)) file = idx;
                }
                return { path: toUrlPath(file) };
            });
        }
    }
};

// bun maps bare `require('events')` to its built-in ESM-style node shim, so
// CJS code doing `class X extends require('events')` gets a namespace object
// and crashes at runtime ("Class extends value #<Object> is not a
// constructor"). bun ignores aliases for node builtins, so intercept the
// specifier with a plugin and resolve it to the npm `events` package, whose
// module.exports is the EventEmitter class (what webpack used to resolve).
const eventsPlugin = {
    name: "bun-events-package",
    setup(build) {
        build.onResolve({ filter: /^events$/ }, args => {
            if (args.kind === "entry-point") return;
            return { path: toUrlPath(path.join(ROOT_DIR, "node_modules", "events", "events.js")) };
        });
    }
};

// Legacy babel-compiled CJS modules (babel-runtime etc.) set
// `exports.__esModule = true; exports.default = fn;`. When ESM code does a
// default import of one, bun's interop makes `default` point at the whole
// exports object instead of `exports.default`, so calls like
// `import_createClass.default(...)` crash ("...default is not a function").
// Rewrite those modules so `module.exports` IS the default fn (with
// `module.exports.default` self-referencing) — both interop styles then work.
const legacyEsModulePlugin = {
    name: "bun-legacy-esmodule-cjs",
    setup(build) {
        build.onResolve({ filter: /^babel-runtime\// }, args => {
            if (args.kind === "entry-point") return;
            let file;
            try {
                file = Bun.resolveSync(args.path, path.dirname(toPlatformPath(args.importer)));
            } catch {
                return;
            }
            return { path: toUrlPath(file), namespace: "bun-legacy-esmodule" };
        });
        build.onLoad({ filter: /\.js$/, namespace: "bun-legacy-esmodule" }, args => {
            let source = readFileSync(toPlatformPath(args.path), "utf8");
            source = rewriteLegacyDefault(source);
            return { loader: "js", contents: source };
        });
    }
};

function rewriteLegacyDefault(source) {
    if (!/exports\.__esModule\s*=\s*true;/.test(source)) return source;
    if (!/exports\.default\s*=/.test(source)) return source;
    const stripped = source.replace(/exports\.__esModule\s*=\s*true;/g, "");
    // Keep original semantics when other named exports are present.
    if (/(^|[^.\w])exports\.(?!default\b)\w+/.test(stripped.replace(/exports\.default\s*=/g, ""))) {
        return source;
    }
    const out = stripped.replace(/exports\.default\s*=/g, "module.exports =");
    return `${out}\nmodule.exports.default = module.exports;\n`;
}

// babel/webpack-compiled CJS packages set `exports.__esModule = true` and put
// the real value on `exports.default`. bun's node-mode interop for ESM default
// imports follows Node semantics and ignores that marker, binding `default` to
// the whole `module.exports` object (webpack honored it). So
// `import MediaQuery from "react-responsive"` yields the namespace object and
// JSX crashes ("Element type is invalid ... but got: object"). Fix: resolve
// those specifiers to a tiny ESM proxy module that unwraps `.default` and
// re-exports the package's named exports unchanged.
const cjsEsModuleInteropSpecifiers = {
    "react-responsive": ["toQuery"],
    "redux-throttle": ["CANCEL", "FLUSH"],
    "@turbowarp/scratch-l10n": ["localeData", "localeMap", "isRtl"]
};

const cjsEsModuleInteropPlugin = {
    name: "bun-cjs-esmodule-default",
    setup(build) {
        for (const [specifier, named] of Object.entries(cjsEsModuleInteropSpecifiers)) {
            const ns = `cjs-interop-${specifier.replace(/\W+/g, "_")}`;
            const filter = new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
            build.onResolve({ filter }, args => {
                if (args.kind === "entry-point") return;
                let file;
                try {
                    file = Bun.resolveSync(specifier, path.dirname(toPlatformPath(args.importer)));
                } catch {
                    return;
                }
                return { path: toUrlPath(file), namespace: ns };
            });
            build.onLoad({ filter: /.*/, namespace: ns }, args => ({
                loader: "js",
                contents: [
                    `import mod from ${JSON.stringify(toUrlPath(args.path))};`,
                    `const real = mod && typeof mod === "object" && mod.__esModule && Object.prototype.hasOwnProperty.call(mod, "default") ? mod.default : mod;`,
                    "export default real;",
                    ...named.map(key => `export const ${key} = mod.${key};`),
                    ""
                ].join("\n")
            }));
        }
    }
};

const webpackDefines = {
    "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
    "process.env.DEBUG": JSON.stringify(Boolean(process.env.DEBUG)),
    "process.env.ANNOUNCEMENT": JSON.stringify(process.env.ANNOUNCEMENT || ""),
    "process.env.ENABLE_SERVICE_WORKER": JSON.stringify(process.env.ENABLE_SERVICE_WORKER || ""),
    "process.env.ROOT": JSON.stringify(root),
    "process.env.ROUTING_STYLE": JSON.stringify(process.env.ROUTING_STYLE || "filehash")
};

// ---------------------------------------------------------------------------
// HTML generation
// ---------------------------------------------------------------------------

function renderEjs(templatePath, options) {
    let html = readFileSync(templatePath, "utf8");
    const { title, noTheme, noSplash } = options;
    html = html.replace(/<%= htmlWebpackPlugin\.options\.title %>/g, title);
    html = html.replace(/<%= htmlWebpackPlugin\.options\.root %>/g, root);

    const matches = true;
    // Simple if/endif blocks used by the templates. Only supports the exact
    // conditions found in index.ejs / simple.ejs.
    html = html.replace(/<% if\s*\((.*?)\)\s*\{\s*%>([\s\S]*?)<% \}\s*%>/g, (match, condition, body) => {
        const expr = condition.replace(/htmlWebpackPlugin\.options\./g, "");
        let truthy;
        if (expr.includes('root === "/" || root === ""') || expr.includes('root === "" || root === "/"')) {
            truthy = root === "/" || root === "";
        } else if (expr.includes("!noTheme")) {
            truthy = !noTheme;
        } else if (expr.includes("!noSplash")) {
            truthy = !noSplash;
        } else {
            throw new Error(`Unsupported EJS condition in ${templatePath}: ${condition}`);
        }
        return truthy ? body : "";
    });
    return html;
}

function generateHtml(pages) {
    for (const page of pages) {
        const templatePath = path.join(SRC_DIR, "playground", page.template);
        let html = renderEjs(templatePath, page);
        const scriptTag = `<script type="module" src="${root}js/${page.entry}.js"></script>`;
        if (html.includes("</body>")) {
            html = html.replace("</body>", `${scriptTag}</body>`);
        } else {
            html += scriptTag;
        }
        writeFileSync(path.join(OUT_DIR, page.file), html);
    }
}

// ---------------------------------------------------------------------------
// Service worker
// ---------------------------------------------------------------------------

async function generateServiceWorker() {
    const swSource = await readFile(path.join(SRC_DIR, "playground", "service-worker.js"), "utf8");
    const files = await readdir(OUT_DIR, { recursive: true });
    const allAssets = files.map(f => toUrlPath(f));

    const htmlAssets = ["index.html", "editor.html", "playground.html", "fullscreen.html", "addons.html"]
        .filter(f => allAssets.includes(f));
    const lazyAssets = allAssets.filter(name => {
        if (htmlAssets.includes(name)) return false;
        if (
            name.startsWith("static/blocks-media") &&
            (
                name.includes("event_broadcast_") ||
                name.includes("event_when-broadcast-received_") ||
                name.includes("event_whenflagclicked") ||
                name.includes("wedo_") ||
                name.includes("set-led_") ||
                name.includes("microbit-block-icon") ||
                name.includes("wedo2-block-icon")
            )
        ) return false;
        if (!name.startsWith("static/") && !name.startsWith("js/") && !name.startsWith("images/")) return false;
        // skip directories (readdir recursive also lists them)
        return path.extname(name) !== "";
    });
    const id = sha1Json(allAssets);
    const worker = swSource
        .replace("__HTML_ASSETS__", JSON.stringify(htmlAssets))
        .replace("__LAZY_ASSETS__", JSON.stringify(lazyAssets))
        .replace("__LAZY_ASSETS_NAME__", JSON.stringify(`tw-lazy-${id}`));
    await writeFile(path.join(OUT_DIR, "sw.js"), worker);
}

const sha1Json = obj => crypto.createHash("sha1").update(JSON.stringify(obj)).digest("hex");

// ---------------------------------------------------------------------------
// Copy helpers
// ---------------------------------------------------------------------------

async function copyDirContents(fromDir, toDir) {
    await mkdir(toDir, { recursive: true });
    const entries = await readdir(fromDir, { withFileTypes: true });
    for (const entry of entries) {
        await cp(path.join(fromDir, entry.name), path.join(toDir, entry.name), { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

async function doBuild() {
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(JS_DIR, { recursive: true });

    workerArtifacts.clear();
    console.log("Preparing workers...");
    await prepareWorkers();

    const wanted = new Set(onlyEntries);
    const pages = PAGES.filter(p => wanted.size === 0 || wanted.has(p.entry));

    // Each page entry is wrapped so the browser-globals polyfill module runs
    // first (module init order follows import order), mirroring the node-style
    // globals webpack4 used to provide. The wrapper files live in a temp dir
    // under build/ and are named after the page so output stays flat js/<page>.js.
    const TMP_ENTRY_DIR = path.join(OUT_DIR, ".tmp-entry");
    await mkdir(TMP_ENTRY_DIR, { recursive: true });
    const entrypoints = [];
    for (const page of pages) {
        const entryFile = page.entry === "credits"
            ? path.join("credits", "credits.jsx")
            : `${page.entry}.jsx`;
        const wrapperPath = path.join(TMP_ENTRY_DIR, `${page.entry}.js`);
        const polyRel = toUrlPath(path.relative(TMP_ENTRY_DIR, path.join(SRC_DIR, "lib", "tw-browser-globals.js")));
        const entryRel = toUrlPath(path.relative(TMP_ENTRY_DIR, path.join(SRC_DIR, "playground", entryFile)));
        await writeFile(
            wrapperPath,
            `import ${JSON.stringify(polyRel)};\nimport ${JSON.stringify(entryRel)};\n`
        );
        entrypoints.push(toUrlPath(wrapperPath));
    }

    console.log(`Bundling ${entrypoints.length} entries...`);
    const result = await bunBuild({
        entrypoints,
        outdir: toUrlPath(JS_DIR),
        format: "esm",
        target: "browser",
        splitting: true,
        sourcemap: isProduction ? undefined : "linked",
        minify: isProduction,
        // Entries like src/playground/credits/credits.jsx must land flat at
        // js/credits.js (matching the html script tags), not js/credits/credits.js.
        naming: { entry: "[name].[ext]" },
        define: webpackDefines,
        plugins: [aliasPlugin, eventsPlugin, legacyEsModulePlugin, cjsEsModuleInteropPlugin, loaderShimPlugin, workerLoaderPlugin, cssModulePlugin, assetPlugin, nodeStubPlugin, flowTypeStubPlugin]
    });

    if (!result.success) {
        console.error(result.logs);
        process.exitCode = 1;
        return;
    }

    for (const output of result.outputs) {
        if (output.kind === "entry-point") {
            console.log(`bundled ${toUrlPath(path.relative(OUT_DIR, toPlatformPath(output.path)))}`);
        }
    }

    await flushAssets();

    // CopyWebpackPlugin equivalents
    if (existsSync(STATIC_DIR)) await copyDirContents(STATIC_DIR, OUT_DIR);
    const blocksMedia = path.join(ROOT_DIR, "node_modules", "scratch-blocks", "media");
    if (existsSync(blocksMedia)) {
        await cp(blocksMedia, path.join(OUT_DIR, "static", "blocks-media"), { recursive: true, force: true });
    }
    const extensionsSrc = path.join(SRC_DIR, "examples", "extensions");
    if (existsSync(extensionsSrc)) {
        await cp(extensionsSrc, path.join(OUT_DIR, "static", "extensions"), { recursive: true, force: true });
    }

    await rm(TMP_ENTRY_DIR, { recursive: true, force: true });
    generateHtml(pages);
    await generateServiceWorker();

    await rm(TMP_BUILD_DIR, { recursive: true, force: true });
    console.log("Build complete!");
}

// ---------------------------------------------------------------------------
// Dev server & watch
// ---------------------------------------------------------------------------

const HISTORY_REWRITES = [
    [/^\/(\d+)\/?$/, "index.html"],
    [/^\/\d+\/fullscreen\/?$/, "fullscreen.html"],
    [/^\/\d+\/editor\/?$/, "editor.html"],
    [/^\/\d+\/playground\/?$/, "playground.html"],
    [/^\/\d+\/embed\/?$/, "embed.html"],
    [/^\/addons\/?$/, "addons.html"]
];

function debounce(fn, ms) {
    let timer = null;
    return () => {
        clearTimeout(timer);
        timer = setTimeout(fn, ms);
    };
}

async function serve() {
    const port = Number(process.env.PORT || 3000);
    const server = Bun.serve({
        port,
        async fetch(req) {
            const { pathname } = new URL(req.url);
            let relative = decodeURIComponent(pathname).replace(/^\/+/, "");
            if (relative === "") relative = "index.html";
            if (!path.extname(relative)) {
                const withExt = relative.endsWith("/")
                    ? `${relative}index.html`
                    : `${relative}.html`;
                const candidate = path.join(OUT_DIR, withExt);
                if (existsSync(candidate)) relative = withExt;
            }
            const file = path.join(OUT_DIR, relative);
            if (existsSync(file) && !(await stat(file)).isDirectory()) {
                const ext = path.extname(file).toLowerCase();
                return new Response(Bun.file(file), {
                    headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" }
                });
            }
            for (const [re, fallback] of HISTORY_REWRITES) {
                if (re.test(pathname)) {
                    const fb = path.join(OUT_DIR, fallback);
                    if (existsSync(fb)) return new Response(Bun.file(fb));
                }
            }
            return new Response("Not Found", { status: 404 });
        }
    });
    console.log(`Serving ${OUT_DIR} at http://localhost:${server.port}`);
    return server;
}

async function watchSources(onChange) {
    const watched = new Set();
    const targets = [SRC_DIR, STATIC_DIR];
    const onAny = debounce(onChange, 200);
    const walk = async dir => {
        if (watched.has(dir)) return;
        watched.add(dir);
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
                await walk(path.join(dir, entry.name));
            }
        }
        watch(dir, { persistent: true }, onAny);
    };
    for (const target of targets) await walk(target);
    console.log("Watching for changes...");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    if (isWatch) {
        let building = false;
        let dirty = false;
        const rebuild = async () => {
            if (building) {
                dirty = true;
                return;
            }
            building = true;
            dirty = false;
            try {
                await doBuild();
            } catch (e) {
                console.error("build failed:", e);
            }
            building = false;
            if (dirty) rebuild();
        };
        if (isServe) await serve();
        await rebuild();
        await watchSources(rebuild);
        await new Promise(() => {});
    } else {
        await doBuild();
        if (isServe) {
            await serve();
            await new Promise(() => {});
        }
    }
}

main().catch(err => {
    console.error("build failed:", err);
    process.exit(1);
});