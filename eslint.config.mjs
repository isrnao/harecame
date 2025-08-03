import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";
import nextPlugin from "@next/eslint-plugin-next";
import parser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  // Base JavaScript recommended rules
  js.configs.recommended,

  // Main configuration for all files
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
      "@typescript-eslint": tsPlugin,
      "@next/next": nextPlugin,
    },
    settings: {
      react: { version: "19.1" },
    },
    rules: {
      // JavaScript/TypeScript基本ルール
      "no-unused-vars": "off", // TypeScriptルールを使用
      "no-undef": "off", // TypeScriptが処理

      // React Hooks v5.2.0+ 推奨ルール
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // React 基本ルール（2025年基準）
      "react/react-in-jsx-scope": "off", // React 17+では不要
      "react/prop-types": "off", // TypeScriptを使用
      "react/jsx-uses-react": "off", // React 17+では不要
      "react/jsx-uses-vars": "error",
      "react/jsx-key": "error",
      "react/no-array-index-key": "warn",
      "react/no-deprecated": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-unescaped-entities": "warn",

      // Next.js 15 推奨ルール
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"]?.rules,
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-sync-scripts": "error",
      "@next/next/no-css-tags": "error",

      // TypeScript 2025年推奨ルール
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-var-requires": "error",

      // ES2024+ 機能活用推奨
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      "prefer-template": "warn",
      "object-shorthand": "warn",
      "no-var": "error",
    },
  },

  // テストファイル専用設定
  {
    files: ["**/__tests__/**", "**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  // 設定ファイル専用設定
  {
    files: ["*.config.{js,mjs,ts}", "*.setup.{js,ts}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-undef": "off",
    },
  },
];
