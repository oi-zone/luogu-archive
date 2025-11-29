//  @ts-check

import { version as typescriptVersion } from "typescript";

/** @type {import("prettier").Config & import("@ianvs/prettier-plugin-sort-imports").PluginConfig & import("prettier-plugin-tailwindcss").PluginOptions} */
export default {
  trailingComma: "all",
  overrides: [
    {
      files: ["tsconfig.json", "tsconfig.*.json"],
      options: { parser: "jsonc" },
    },
  ],
  plugins: [
    "@ianvs/prettier-plugin-sort-imports",
    "prettier-plugin-tailwindcss",
  ],
  importOrder: [
    "<BUILTIN_MODULES>",
    "",
    "^react(/.*)?$",
    "^react-dom(/.*)?$",
    "<THIRD_PARTY_MODULES>",
    "",
    "^@luogu-discussion-archive/",
    "",
    "^@/lib/",
    "^@/hooks/",
    "^@/components/ui/",
    "^@/components/",
    "",
    "^[.]",
  ],
  importOrderTypeScriptVersion: typescriptVersion,
  tailwindStylesheet: "./apps/web/app/globals.css",
};
