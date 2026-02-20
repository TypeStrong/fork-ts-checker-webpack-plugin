const {
    defineConfig,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const _import = require("eslint-plugin-import");
const prettier = require("eslint-plugin-prettier");

const {
    fixupPluginRules,
} = require("@eslint/compat");

const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
    },

    plugins: {
        "@typescript-eslint": typescriptEslint,
        import: fixupPluginRules(_import),
        prettier,
    },

    extends: compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
    ),

    settings: {
        node: {
            tryExtensions: [".js", ".json", ".ts", ".d.ts"],
        },

        "import/extensions": [".js", ".json", ".ts", ".d.ts"],
        "import/external-module-folders": ["node_modules", "node_modules/@types"],

        "import/parsers": {
            "@typescript-eslint/parser": [".ts"],
        },

        "import/resolver": {
            node: {
                extensions: [".js", ".json", ".ts", ".d.ts"],
            },
        },
    },

    rules: {
        "@typescript-eslint/consistent-type-imports": ["error", {
            prefer: "type-imports",
        }],

        "import/order": ["error", {
            groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
            "newlines-between": "always",

            alphabetize: {
                order: "asc",
                caseInsensitive: true,
            },
        }],

        "import/no-cycle": ["error"],
        "prettier/prettier": "error",
    },
}, {
    files: ["**/*.ts"],

    rules: {
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-use-before-define": "off",
    },
}, {
    files: ["**/*.spec.ts"],

    rules: {
        "@typescript-eslint/no-var-requires": "off",
    },
}, {
    ignores: ["lib/**/*", "test/e2e/fixtures/**/*"],
}]);
