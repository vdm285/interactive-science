import { defineConfig } from 'vite';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, posix } from 'node:path';

// Stamp the built sw.js with a build id, this build's hashed files and the ones the built page loads, so
// every deploy installs a new worker: its install stores the page and those files, its activate drops the
// bundles of earlier deploys from the cache (public/sw.js). A stamp that would let the worker prune the
// page's own files (no files found, or an entry the list lacks) fails the build.
const swStamp = () => {
  let outDir = 'dist';
  let assetsDir = 'assets';
  const list = (dir, rel) => (existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : [])
    .flatMap((d) => (d.isDirectory() ? list(resolve(dir, d.name), posix.join(rel, d.name)) : [posix.join(rel, d.name)]));
  return {
    name: 'sw-stamp',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      assetsDir = config.build.assetsDir;
    },
    closeBundle() {
      const f = resolve(outDir, 'sw.js');
      if (!existsSync(f)) return;
      const marker = '/*__SW_BUILD__*/ null';
      const src = readFileSync(f, 'utf8');
      if (!src.includes(marker)) throw new Error(`sw-stamp: ${marker} not found in ${f}`);
      const files = list(resolve(outDir, assetsDir), assetsDir).sort();
      if (!files.length) throw new Error(`sw-stamp: no files under ${resolve(outDir, assetsDir)}`);
      // what the built page loads from assets/ (the module entry script, the stylesheet), as paths in the build
      const page = resolve(outDir, 'index.html');
      if (!existsSync(page)) throw new Error(`sw-stamp: ${page} not found`);
      const html = readFileSync(page, 'utf8');
      const inBuild = (v) => (v.includes(`${assetsDir}/`) ? v.slice(v.lastIndexOf(`${assetsDir}/`)) : v);
      const scripts = (html.match(/<script\b[^>]*>/g) || []).filter((t) => /\btype="module"/.test(t))
        .map((t) => t.match(/\bsrc="([^"]+)"/)?.[1]).filter(Boolean).map(inBuild);
      const entry = [...new Set([...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1])
        .filter((v) => v.includes(`${assetsDir}/`)).map(inBuild))];
      const missing = [...new Set([...scripts, ...entry])].filter((p) => !files.includes(p));
      if (!scripts.length || missing.length) {
        throw new Error(`sw-stamp: the entry script of ${page} is not among the files of ${assetsDir}/ (${missing.join(', ') || 'no module script'})`);
      }
      const id = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
      writeFileSync(f, src.replace(marker, () => JSON.stringify({ id, dir: `${assetsDir}/`, files, entry })));
    },
  };
};

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
  server: { port: 5174, host: true },
  plugins: [swStamp()],
});
