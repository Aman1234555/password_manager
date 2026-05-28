import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser
      },
      ecmaVersion: 2023,
      sourceType: 'module'
    }
  }
];

