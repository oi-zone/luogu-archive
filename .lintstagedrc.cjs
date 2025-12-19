const eslint = "eslint --flag unstable_config_lookup_from_file --fix";
const prettier = "prettier --write";
const prisma = "pnpm --filter db exec prisma format";

module.exports = {
  "*.{js,mjs,cjs,jsx,ts,tsx}": [eslint, prettier],
  "*.{md,mdx,html,css,scss,json,yml,yaml}": prettier,
  "*.prisma": prisma,
};
