import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

export default defineConfig(
  { ignores: ['dist/', '.astro/', '.vercel/', '.claude/', 'recursos/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  // La conexión del panel (rol vitalis_admin) solo se usa en el panel: las páginas públicas usan vitalis_app.
  {
    files: ['src/**/*.{ts,astro}'],
    ignores: [
      'src/admin/**',
      'src/actions/admin/**',
      'src/pages/admin/**',
      'src/layouts/AdminLayout.astro',
      'src/components/admin/**',
      'src/middleware.ts',
      // Registro de Actions: solo enlaza las del panel, no usa su conexión.
      'src/actions/index.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/client-admin', '**/admin/*'],
              message:
                'El panel y su conexión solo se usan desde src/admin, src/actions/admin y src/pages/admin.',
            },
          ],
        },
      ],
    },
  },
);
