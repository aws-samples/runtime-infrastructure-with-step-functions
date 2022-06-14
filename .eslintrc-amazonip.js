module.exports = {
    "env": {
        "node": true,
        "es6": true
    },
    "plugins": ["@typescript-eslint", "header"],
    "extends": ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
    "parserOptions": { "project": "tsconfig.json" },
    "rules": {
        "quotes": ["error", "double"],
        "max-len": ["error", 165],
        "arrow-parens": ["error", "as-needed"],
        "indent": ["error", 4],
        "sort-keys": "off",
        "comma-dangle": ["error", "always-multiline"],
        "radix": ["error", "as-needed"],
        "semi": ["error", "always"],
        "@typescript-eslint/naming-convention": [
            "error",
            {
                "selector": "interface",
                "format": ["PascalCase"],
                "custom": {
                    "regex": "^I[A-Z]",
                    "match": false
                }
            }
        ],
        "@typescript-eslint/no-floating-promises": ["error"],
        "header/header": [
            2,
            "line",
            [
                " Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.",
                " SPDX-License-Identifier: MIT-0"
            ],
            1
        ],
        "@typescript-eslint/member-delimiter-style": ["error"]
    }
}
