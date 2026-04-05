import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import fs from "fs";

const prod = process.argv[2] === "production";

const copyPlugin = {
  name: "copy-to-root",
  setup(build) {
    build.onEnd(() => {
      fs.copyFileSync("build/main.js", "main.js");
      fs.copyFileSync("build/styles.css", "styles.css");
    });
  },
};

const context = await esbuild.context({
  entryPoints: [
    { in: "src/main.ts",          out: "main"   },
    { in: "src/styles/index.css", out: "styles" },
  ],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outdir: "build",
  minify: prod,
  plugins: [copyPlugin],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
