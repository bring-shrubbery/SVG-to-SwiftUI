import baseConfig, { restrictEnvAccess } from "@svg-to-swiftui/eslint-config/base";
import nextjsConfig from "@svg-to-swiftui/eslint-config/nextjs";
import reactConfig from "@svg-to-swiftui/eslint-config/react";

/** @type {import('typescript-eslint').Config} */
export default [
  {
    ignores: [".next/**"],
  },
  ...baseConfig,
  ...reactConfig,
  ...nextjsConfig,
  ...restrictEnvAccess,
];