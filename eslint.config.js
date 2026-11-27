import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { defineConfig } from 'eslint/config';
import astro from 'eslint-plugin-astro';
import globals from 'globals';

const SOLO_PANEL = {
  group: ['**/db/client-admin', '**/admin/*'],
  message: 'El panel y su conexión solo se usan desde src/admin, src/actions/admin y src/pages/admin.',
};
const SOLO_PORTAL = {
  group: ['**/db/client-cuenta'],
  message: 'La conexión del portal de clientes (vitalis_cuenta) solo se usa desde src/cuenta.',
};

export default defineConfig(
  { ignores: ['dist/', '.astro/', '.vercel/', '.claude/', 'recursos/', 'node_modules/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...astro.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  // Nada de console en el código de la web: los errores del servidor pasan por src/lib/registro.ts.
  // Los scripts de terminal (scripts/) sí escriben en consola: es su forma de hablar con quien los ejecuta.
  { files: ['src/**/*.{ts,astro}'], ignores: ['src/lib/registro.ts'], rules: { 'no-console': 'error' } },
  // Tres conexiones, tres zonas. Las páginas públicas usan vitalis_app; el panel, vitalis_admin; el portal de
  // clientes, vitalis_cuenta (con RLS).
  {
    files: ['src/**/*.{ts,astro}'],
    ignores: [
      'src/admin/**',
      'src/actions/admin/**',
      'src/pages/admin/**',
      'src/layouts/AdminLayout.astro',
      'src/components/admin/**',
      'src/middleware.ts',
      // Registro de Actions: solo enlaza las del panel y lee quién tiene sesión.
      'src/actions/index.ts',
      // Actions del portal: registro e ingreso usan el núcleo de sesiones, igual que el login del panel.
      'src/actions/cuenta.ts',
      'src/cuenta/**',
      'src/pages/cuenta/**',
    ],
    rules: { 'no-restricted-imports': ['error', { patterns: [SOLO_PANEL, SOLO_PORTAL] }] },
  },
  // El portal lee sus datos con vitalis_cuenta. Del panel solo puede usar las reglas de autorización, que no
  // tocan la base.
  {
    files: ['src/cuenta/**/*.ts', 'src/pages/cuenta/**/*.{ts,astro}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { ...SOLO_PANEL, group: [...SOLO_PANEL.group, '!**/admin/autorizacion', '!**/admin/permisos'] },
          ],
        },
      ],
    },
  },
  // El panel no usa la conexión del portal.
  {
    files: ['src/admin/**', 'src/actions/admin/**', 'src/pages/admin/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [SOLO_PORTAL] }] },
  },
);
