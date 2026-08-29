import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
    },
    rules: {
      // Surface `any` as a warning so it stays visible without failing the
      // build. The codebase is effectively `any`-free; this keeps it that way.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    // Build-time tooling, run by hand with `node`, never bundled. It needs
    // Node globals (Buffer, process) that the browser-globals block above
    // does not provide. An override of this shape existed once for
    // scripts/generate-sitemap.mjs and was removed with it in 9cda460; it is
    // back because scripts/generate-icons.mjs lives here now.
    files: ["scripts/**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    ignores: ["dist/", "node_modules/", "*.cjs", "**/counties_topo.js"],
  }
);
