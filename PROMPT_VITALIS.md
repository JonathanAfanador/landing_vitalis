# Prompt · Landing de VITALIS Centro Veterinario

> Cópialo entero en Claude Code, abierto en la raíz de este repositorio (`landing_vitalis`, rama `dev_jonathan`).
> Antes de pegarlo, rellena los campos marcados con `[COMPLETAR]`. Lo que dejes sin rellenar se marcará como pendiente y no se inventará.

---

```text
Usa las skills landing-page-design y ui-ux-pro-max (están en .claude/skills/) y, para el recorrido con scroll, la técnica de scrub de la skill scroll-world. Vamos a crear desde cero la landing completa y funcional de VITALIS CENTRO VETERINARIO, un negocio real en Girardot, Cundinamarca (Colombia). La referencia de estilo y proceso es el proyecto de midudev "mcp-higgsfield-landing" (landing de Arko): Astro + Tailwind + GSAP ScrollTrigger + Lenis, contenido centralizado en un archivo de datos, scroll world con vídeos reales, SEO completo y peso mínimo.

## 0. Reglas que no se negocian

1. Es un negocio real: usa SOLO los datos de este mensaje y lo que veas en las fotos y vídeos. No inventes reseñas, testimonios, cifras ("+1.000 mascotas"), años de experiencia, títulos del doctor, precios, horarios ni premios. Lo que falte se marca con un componente <Pending> (visible solo en `pnpm dev`, nunca en el build), igual que en el proyecto de midudev.
2. Buena programación, sin código de más: TypeScript estricto, componentes pequeños y con una sola responsabilidad, nada de dependencias que no se usen, nada de abstracciones "por si acaso", nada de código muerto ni comentarios obvios. Si una librería no aporta, no se instala.
3. Rendimiento: la landing tiene que ser liviana. Objetivo Lighthouse ≥ 95 en Performance, Accesibilidad, Buenas prácticas y SEO (móvil). CLS < 0,1. HTML de la portada < 120 KB.
4. Accesibilidad WCAG 2.2 AA: contraste 4.5:1 en texto, foco visible, navegación con teclado, alt descriptivos en español, respeto a `prefers-reduced-motion` y a ahorro de datos.
5. Mobile first. La mayoría del tráfico vendrá de Instagram, WhatsApp y Google Maps en el celular.
6. Antes de escribir código, devuélveme lo que pide el "Output format" de landing-page-design (ver sección 6) y espera mi aprobación.

## 1. Preparación del proyecto

1. Verifica que las skills están instaladas en .claude/skills/: landing-page-design, ui-ux-pro-max y scroll-world. Si falta alguna, avísame; no la sustituyas por otra.
2. Comprueba requisitos: Node.js ≥ 22.12, pnpm y ffmpeg/ffprobe (en Windows: `winget install Gyan.FFmpeg`). Si falta algo, dime el comando para instalarlo.
3. Inicia el proyecto Astro en la raíz del repo con pnpm (TypeScript strict) y añade solo lo necesario: Tailwind CSS 4 (@tailwindcss/vite), GSAP (ScrollTrigger), Lenis, sharp, @astrojs/sitemap y el adaptador del hosting elegido (ver sección 4). Iconos SVG (Phosphor o Lucide), nunca emojis como iconos.
4. Configura ESLint + Prettier, `.editorconfig`, `.gitignore` (node_modules, dist, .env, media/) y un `.env.example` documentado. Ningún secreto en el repo.
5. Copia el material de `C:\Users\jonathan.DESKTOP-VV9J5N6\Desktop\Archivo_vet` a `media/originales/` (carpeta ignorada por git: es material de trabajo, no se publica).

## 2. Optimización de imágenes y vídeos (obligatorio antes de usarlos)

Imágenes:
- Revisa una por una y descarta las borrosas, repetidas o mal encuadradas (dime cuáles).
- Las que se usen en componentes van en `src/assets/` y se sirven con <Picture> / <Image> de astro:assets en AVIF + WebP, con `widths` y `sizes` reales, `loading="lazy"` salvo la imagen del hero (`fetchpriority="high"`), y width/height siempre definidos para no generar CLS.
- Nombra los archivos de forma descriptiva y en minúsculas (`recepcion.jpg`, `quirofano.jpg`…), no `IMG_2034.jpg`.
- Quita metadatos EXIF (ubicación GPS incluida).
- Las fotos que se enlacen desde JSON-LD o el sitemap van además en `public/photos/` como JPG a 1600 px, calidad ~80.
- Genera `og-image.jpg` (1200×630), favicon SVG + ICO, apple-touch-icon y los iconos del manifest.

Vídeos:
- Sin audio, H.264 en MP4, `-movflags +faststart`, máximo 1080p (y una versión 720p para móvil si el ahorro es grande), CRF 26–30. Objetivo: cada clip ≤ 3 MB.
- Los clips que se usen en el scroll world llevan keyframe cada 6 fotogramas y color marcado como BT.709/sRGB para que el póster y el vídeo no cambien de tono (mismo comando que en el README de midudev):
  ffmpeg -i in.mp4 -an -vf "scale=1920:-2" -c:v libx264 -preset slow -crf 28 -g 6 -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p -color_primaries bt709 -color_trc iec61966-2-1 -colorspace bt709 -color_range tv -movflags +faststart+write_colr out.mp4
- Póster de cada clip: su primer fotograma en WebP.
- Al terminar, dame una tabla con peso antes / después de cada archivo.

## 3. Intake del negocio (para landing-page-design)

- Nombre: VITALIS CENTRO VETERINARIO.
- Ubicación: Girardot, Cundinamarca, Colombia. Dirección: [COMPLETAR]. Coordenadas: [COMPLETAR o sácalas del enlace de Google Maps: COMPLETAR].
- Especialidad: el médico veterinario que opera está especializado en procedimientos de ortopedia (fracturas, luxaciones, cirugía de rodilla/cadera, etc.). Lista verificada de procedimientos que realiza: [COMPLETAR]. Si no la tengo, marca la lista como pendiente; no la inventes.
- Doctor: nombre [COMPLETAR], tarjeta profesional / formación [COMPLETAR].
- Tienda: se venden SOLO medicamentos veterinarios (no alimentos, no accesorios).
- Acción principal: pedir medicamentos (catálogo → pedido que se confirma por WhatsApp).
- Acción secundaria, más abajo: agendar una valoración ortopédica.
- Contacto: WhatsApp [COMPLETAR], teléfono [COMPLETAR], correo [COMPLETAR], Instagram [COMPLETAR], Facebook [COMPLETAR].
- Horario: [COMPLETAR]. ¿Atiende urgencias? [COMPLETAR].
- Domicilios: ¿hay entregas a domicilio en Girardot y alrededores (Flandes, Ricaurte, Melgar…)? [COMPLETAR].
- Público (asumido): tutores de perros y gatos de Girardot y municipios cercanos, y otros veterinarios que remiten casos de ortopedia.
- Objeciones (asumidas): confianza en una cirugía ortopédica, precio, si el medicamento es original/legal, si necesita fórmula, tiempos de entrega.
- Tono: cálido, cercano, tranquilo y profesional. Que transmita el ambiente cálido del lugar.
- Idioma: español de Colombia (es-CO). Precios en pesos colombianos (COP, enteros, formato $ 45.900).

## 4. Diseño

- Paleta base: dorado cálido, blanco y azul. ANTES de fijarla, analiza las fotos y vídeos de Archivo_vet, extrae los colores reales del lugar (paredes, logo, uniformes, luz) y ajusta la paleta a ellos. Devuélveme los tokens con su hex y el contraste de cada combinación texto/fondo.
  Punto de partida orientativo (ajústalo con las imágenes): dorado #C8963E, blanco cálido #FBF8F2, azul profundo #1E3A5F.
  Ojo: el dorado sobre blanco no da contraste para texto. Úsalo como acento (líneas, iconos, fondos de sección, detalles); el texto y los botones principales en azul o con texto oscuro sobre dorado.
- Ambiente: cálido. Fondos claros y cremosos, luz cálida, esquinas suaves, fotografía real protagonista. Nada de estética fría de hospital, nada de clipart de patitas genérico ni de plantilla SaaS.
- Tipografía: elígela con landing-page-design y ui-ux-pro-max buscando "cálida, cercana y profesional". Fuentes servidas desde el propio dominio, recortadas a latín, sin cursivas ni negritas sintéticas.
- Layout: scroll world como en Arko. La portada es un recorrido por la clínica (entrada → recepción → consultorio → quirófano/ortopedia → farmacia) que avanza y retrocede con el scroll usando los vídeos reales de Archivo_vet (sin generar vídeos con IA, salvo que te lo pida). Un texto corto por parada. Carga por cercanía, pósters debajo, sin vídeo con reduced-motion o ahorro de datos, y el truco de play()/pause() para iOS. Si los vídeos no sirven para un recorrido continuo, dímelo y propón la alternativa (por ejemplo, un vídeo de fondo por sección).
- Cabecera tipo píldora flotante, botón flotante de WhatsApp con aria-label, y la sección de tagline obligatoria de la skill.

Secciones propuestas (ajústalas con la skill y justifícalo):
1. Hero / scroll world por la clínica.
2. Tagline.
3. Ortopedia veterinaria: qué se trata, cómo es el proceso (valoración → cirugía → recuperación), y CTA a agendar valoración.
4. El doctor (solo datos verificados).
5. Tienda de medicamentos: buscador, filtros por especie y categoría, tarjetas de producto, carrito y pedido.
6. Cómo pedir en 3 pasos.
7. Por qué Vitalis (beneficios reales, sin cifras inventadas).
8. Testimonios: solo si te los doy; si no, Pending.
9. Ubicación y horarios (mapa de Google embebido con carga diferida, solo al hacer clic o al entrar en pantalla).
10. FAQ (6–12): fórmula médica, envíos, medios de pago, originalidad de los medicamentos, urgencias, cómo prepararse para una cirugía.
11. CTA final.
12. Footer: datos de contacto, redes, política de tratamiento de datos (Ley 1581 de 2012) y términos.

## 5. Funcionalidad, backend y base de datos

La tienda y los formularios necesitan persistencia. Usa:
- Astro en modo servidor solo para las rutas que lo necesitan (la landing se queda prerenderizada) con Astro Actions para los formularios.
- PostgreSQL (Neon o Supabase, plan gratuito) con Drizzle ORM y migraciones versionadas en el repo. Validación con Zod en el servidor (nunca confiar solo en el cliente). Consultas siempre parametrizadas a través del ORM.
- Si está instalada, sigue la skill supabase-postgres-best-practices para el esquema.

Modelo de datos (normalizado; ajústalo si ves algo mejor y explícame por qué):
- especies (id, nombre, slug único) → perro, gato, otros.
- categorias (id, nombre, slug único) → antiparasitarios, antibióticos, antiinflamatorios, analgésicos, dermatológicos, articulares/condroprotectores, etc.
- medicamentos (id, nombre, slug único, principio_activo, presentacion, laboratorio, registro_ica, requiere_formula boolean, precio_cop integer, stock integer >= 0, activo boolean, imagen, categoria_id FK, created_at, updated_at).
- medicamento_especie (medicamento_id FK, especie_id FK, PK compuesta) → relación N:M.
- pedidos (id, codigo legible único, nombre_cliente, telefono, email opcional, direccion, municipio, estado enum [pendiente, confirmado, enviado, entregado, cancelado], total_cop, notas, acepta_tratamiento_datos boolean, created_at).
- pedido_items (pedido_id FK on delete cascade, medicamento_id FK, cantidad > 0, precio_unitario_cop guardado en el momento de la compra, PK compuesta).
- solicitudes_cita (id, nombre_tutor, telefono, nombre_mascota, especie_id FK, motivo, tipo enum [valoracion_ortopedica, control, otro], fecha_preferida, estado enum, acepta_tratamiento_datos, created_at).
- CHECKs en precios, stock y cantidades; índices en las FK, slugs y en los campos por los que se filtra (categoria_id, activo).
- El total del pedido se calcula SIEMPRE en el servidor a partir de los precios de la base de datos, nunca se confía en el que manda el navegador. Crear el pedido y sus ítems va en una transacción.
- Seed con datos de ejemplo claramente marcados como ficticios (solo para desarrollo, nunca en producción).

Flujos:
- Carrito en el cliente (estado mínimo, persistido en localStorage) → checkout con datos de entrega → se guarda el pedido → se abre WhatsApp con el resumen y el código del pedido.
- Medicamentos con requiere_formula = true: no se pueden pedir sin indicar que se tiene fórmula médica veterinaria; avisa que se pedirá por WhatsApp.
- Formulario de cita: guarda la solicitud y ofrece abrir WhatsApp.
- Protección anti-spam en formularios (honeypot + rate limit simple), mensajes de error junto al campo, estados de carga, éxito y error.
- Checkbox obligatorio de autorización de tratamiento de datos (Ley 1581) en todos los formularios.
- Pasarela de pagos (Wompi, Mercado Pago…): NO la integres todavía. Deja el diseño preparado y pregúntame.
- Panel de administración mínimo en /admin, protegido con autenticación (sin registro público): CRUD de medicamentos (incluido stock y activo) y listado de pedidos y citas con cambio de estado. Nada más. noindex.

Hosting: recomiéndame uno (Vercel o Cloudflare) según el adaptador y la base de datos, explícame el porqué en dos líneas, y deja el despliegue documentado. Sin desplegar hasta que lo apruebe.

## 6. Antes de escribir código, devuélveme

1. La lista de imágenes y vídeos que vas a usar, cuáles descartas y en qué sección va cada uno.
2. La paleta final con tokens, hex y contrastes, y la tipografía elegida.
3. Lo que pide el Output format de landing-page-design: outline de la página, copy del hero, beneficios, cómo funciona, FAQ, SEO/AEO y layout recomendado.
4. El esquema de base de datos (diagrama en texto o Mermaid).
5. La estructura de carpetas que vas a crear.
6. Las preguntas sobre todo lo que siga pendiente, en un solo bloque.

## 7. Estructura esperada (orientativa)

src/
├── data/vitalis.ts        Todo el contenido: paradas, textos, FAQ, contacto, horarios, SEO
├── data/schema.ts         JSON-LD: VeterinaryCare (LocalBusiness), WebSite, WebPage, FAQPage
├── db/                    schema.ts (Drizzle), cliente, migraciones y seed
├── actions/               Astro Actions: crear pedido, solicitar cita (con Zod)
├── pages/                 index, tienda/[slug] si hace falta, admin, 404, robots.txt, llms.txt
├── layouts/Layout.astro   metas, Open Graph, fuentes
├── components/            secciones pequeñas y reutilizables, ScrollWorld, Pending
├── scripts/               motion.ts (Lenis + GSAP), world.ts (scrub), cart.ts
├── styles/global.css      tokens de Tailwind
└── assets/                fotos, pósters, fuentes, logo

## 8. SEO local

- Título y descripción enfocados en "veterinaria en Girardot", "ortopedia veterinaria Girardot" y "medicamentos veterinarios Girardot", sin relleno de palabras clave.
- JSON-LD con @type VeterinaryCare: dirección, geo, horario, teléfono, sameAs a redes, área servida (Girardot, Flandes, Ricaurte…), FAQPage. Todo sale de src/data/vitalis.ts.
- Canonical, lang es-CO, Open Graph y Twitter Card, sitemap sin /admin ni la 404, robots.txt y llms.txt.

## 9. Calidad y entrega

- Tests: Vitest para la lógica (cálculo de totales, validaciones Zod, formateo COP) y Playwright para los flujos clave (añadir al carrito → pedido, formulario de cita, navegación con teclado, móvil y escritorio). Si está instalada, usa la skill webapp-testing.
- Antes de cada entrega: `pnpm build` sin errores ni warnings, `pnpm lint`, tests en verde y revisión con el checklist de landing-page-design y el pre-delivery checklist de ui-ux-pro-max.
- Commits pequeños y descriptivos (Conventional Commits) al terminar cada fase, en la rama dev_jonathan.
- README en español como el de midudev: puesta en marcha, comandos, cómo funciona el scroll world, estructura, cómo editar contenido, base de datos y migraciones, cómo cambiar un vídeo, SEO, despliegue y lista de pendientes.

Trabaja por fases y para en cada una para que la revise:
Fase 1 → análisis del material y entregables de la sección 6 (sin código).
Fase 2 → proyecto base, optimización de media, diseño y secciones estáticas con el scroll world.
Fase 3 → base de datos, tienda, carrito y pedidos.
Fase 4 → citas, panel /admin y autenticación.
Fase 5 → SEO, rendimiento, accesibilidad, tests y README.
```
