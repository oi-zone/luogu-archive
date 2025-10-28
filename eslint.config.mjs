// @ts-check

import { config } from "@wangxinhe/eslint-config/base";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...config(import.meta.dirname),
  globalIgnores(["packages/remark-lda-lfm"]),
]);
