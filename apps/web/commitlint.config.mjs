/**
 * Enforces Conventional Commits. See ../../CONTRIBUTING.md for the
 * accepted types and scopes.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      1,
      "always",
      [
        "core",
        "boards",
        "projects",
        "crm",
        "hr",
        "support",
        "analytics",
        "dev-tools",
        "finance",
        "legal",
        "marketing",
        "auth",
        "sectors",
        "ui",
        "db",
        "supabase",
        "ci",
        "deps",
        "tests",
        "docs",
      ],
    ],
  },
};
