# Recursos de Vitalis

Material real de la clínica. Aquí solo quedan los originales: lo que usa la web ya está en su sitio.

| Dónde | Qué hay |
| :-- | :-- |
| `recursos/originales/` | Logo (`logo-vitalis.jpg`) y foto de la recepción (`recepcion.jpg`) tal como llegaron. Son la fuente para regenerar o vectorizar. |
| `src/assets/brand/` | Logo vectorizado con potrace (`logo.svg`, `logo-claro.svg` para fondos azules) e isotipo (`isotipo.svg`). |
| `src/assets/fotos/` | Recepción sin metadatos. Astro genera AVIF y WebP a varios anchos. |
| `src/assets/posters/` | Primer fotograma de cada clip en WebP. |
| `public/video/` | Los 3 clips del recorrido (`recorrido-1.mp4` a `recorrido-3.mp4`). |
| `public/` | Favicon, iconos del manifest y `og-image.jpg`. |

## Clips del recorrido

| Clip | Duración | Qué se ve | Peso |
| :-- | :-- | :-- | :-- |
| `recorrido-1.mp4` | 22,7 s | Letrero retroiluminado, flores, afiche de bienvenida, diploma | 2,5 MB |
| `recorrido-2.mp4` | 4,3 s | Estanterías con figuras doradas y plantas | 0,3 MB |
| `recorrido-3.mp4` | 15,6 s | Modelos de huesos y columna, libros de ortopedia, diplomas | 1,1 MB |

El vídeo original pesaba 7 MB. Los 3 clips suman 3,8 MB.

Están codificados para scrub con el scroll: 576×1024, 24 fps, H.264, sin audio, un keyframe cada 6 fotogramas, color BT.709/sRGB y `faststart`. Comando usado:

```sh
ffmpeg -ss <inicio> -i video.mp4 -t <duración> -an \
  -vf "fps=24,scale=576:1024,hqdn3d=1:1:3:3" \
  -c:v libx264 -preset veryslow -crf 29 -g 6 -keyint_min 6 -sc_threshold 0 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc iec61966-2-1 -colorspace bt709 -color_range tv \
  -movflags +faststart+write_colr -map_metadata -1 recorrido-N.mp4
```

## Colores de marca

Medidos sobre el logo original: azul marino `#071834` y dorado `#CCA76C`.

## Logo vectorizado

Se amplió el JPG 4×, se separó una máscara por color (azul marino y dorado) y cada una se trazó con potrace (`-u 1 --turdsize 25 --opttolerance 0.4`). El isotipo sale de trazar solo la parte superior. `logo.svg` pesa 22 KB comprimido e `isotipo.svg` 15 KB; se sirven como archivos aparte (con caché), no en línea.
