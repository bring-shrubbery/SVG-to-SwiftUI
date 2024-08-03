import baseConfig, { restrictEnvAccess } from "@svg-to-swiftui/eslint-config/base";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  // ...restrictEnvAccess,
];