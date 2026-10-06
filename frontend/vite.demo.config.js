// Read-only demo build: `npm run build:demo` → dist-demo/index.html, one self-contained file
// (JS, CSS and the lecture data inlined) so the server can gate the whole demo on a single URL.
// The real components import "../lib/api"; here that resolves to src/demo/api.js, which serves the
// pre-processed lectures instead of calling the backend.
import { readFileSync, readdirSync, rmSync, writeFileSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const demoApi = fileURLToPath(new URL("./src/demo/api.js", import.meta.url));
const outDir = fileURLToPath(new URL("./dist-demo", import.meta.url));

function inlineIntoHtml() {
  return {
    name: "inline-into-html",
    apply: "build",
    closeBundle() {
      const assets = `${outDir}/assets`;
      let html = readFileSync(`${outDir}/demo.html`, "utf8");
      html = html.replace(/<script type="module" crossorigin src="\/assets\/([^"]+)"><\/script>/, (_, f) => {
        const js = readFileSync(`${assets}/${f}`, "utf8").replace(/<\/script/gi, "<\\/script");
        return `<script type="module">${js}</script>`;
      });
      html = html.replace(/<link rel="stylesheet" crossorigin href="\/assets\/([^"]+)">/, (_, f) => `<style>${readFileSync(`${assets}/${f}`, "utf8")}</style>`);
      if (/\/assets\//.test(html)) throw new Error("demo build: an asset was not inlined");
      writeFileSync(`${outDir}/demo.html`, html);
      renameSync(`${outDir}/demo.html`, `${outDir}/index.html`);
      for (const f of readdirSync(assets)) rmSync(`${assets}/${f}`);
      rmSync(assets, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), inlineIntoHtml()],
  resolve: { alias: [{ find: /^\.\.\/lib\/api(\.js)?$/, replacement: demoApi }] },
  build: {
    outDir,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    rollupOptions: { input: fileURLToPath(new URL("./demo.html", import.meta.url)) },
  },
});
