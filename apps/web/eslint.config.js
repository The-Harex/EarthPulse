import js from '@eslint/js';
import hooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  hooks.configs['recommended-latest'],
  { ignores: ['dist'], languageOptions: { globals: { window: 'readonly', document: 'readonly', navigator: 'readonly' } } },
);
