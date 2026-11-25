# Recursos de Vitalis

Material real de la clínica, ya optimizado para la web.

| Carpeta | Qué hay |
| :-- | :-- |
| `originales/` | Logo (`logo-vitalis.jpg`) y foto de la recepción (`recepcion.jpg`) tal como llegaron. Son la fuente para regenerar o vectorizar. |
| `imagenes/` | Logo y su isotipo (perro, gato y círculo) en WebP. Recepción en AVIF y WebP a 600 y 1200 px. |
| `video/` | El vídeo del recorrido (vertical, 9:16) dividido en sus 3 tomas, por los 2 cortes que tiene. |
| `posters/` | Primer fotograma de cada clip en WebP, para mostrarlo mientras carga el vídeo. |

## Clips del recorrido

| Clip | Duración | Qué se ve | Peso |
| :-- | :-- | :-- | :-- |
| `recorrido-1-recepcion.mp4` | 22,7 s | Letrero retroiluminado, flores, afiche de bienvenida, diploma | 2,5 MB |
| `recorrido-2-estanteria-dorada.mp4` | 4,3 s | Estanterías con figuras doradas y plantas | 0,3 MB |
| `recorrido-3-modelos-oseos.mp4` | 15,6 s | Modelos de huesos y columna, libros de ortopedia, diplomas | 1,1 MB |

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
