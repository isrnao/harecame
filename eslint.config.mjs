import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";
import react19 from "eslint-plugin-react-19-upgrade";
import nextPlugin from "@next/eslint-plugin-next";
import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      "react-hooks": fixupPluginRules(reactHooks),
      "react-19-upgrade": react19,
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
    },
    settings: { react: { version: "19.0" } },
    rules: {
      // react-hooks
      ...reactHooks.configs.recommended.rules,
      // React 19 の非推奨パターン検出
      "react-19-upgrade/no-default-props": "error",
      "react-19-upgrade/no-prop-types": "warn",
      "react-19-upgrade/no-legacy-context": "error",
      "react-19-upgrade/no-string-refs": "error",
      "react-19-upgrade/no-factories": "error",
      // Next.js 推奨ルール
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"]?.rules,
      "@next/next/no-img-element": "warn",
      // TypeScript ルール
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      // React 特定ルール
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },
  {
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);
