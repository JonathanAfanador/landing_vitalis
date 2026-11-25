import { ScrollTrigger } from 'gsap/ScrollTrigger';

type Connection = { saveData?: boolean };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

// Recorrido por la clínica: cada parada tiene su clip y el scroll fija su `currentTime` (no hay reproducción).
// El clip de una parada avanza mientras su artículo cruza la pantalla; al pasar el siguiente por el centro
// se cambia de clip, igual que los cortes del vídeo original. Debajo de cada clip está su póster.
export function initWorld(world: HTMLElement, reduceMotion: boolean) {
  const stops = [...world.querySelectorAll<HTMLElement>('[data-stop]')];
  const posters = [...world.querySelectorAll<HTMLElement>('[data-poster]')];
  const clips = [...world.querySelectorAll<HTMLVideoElement>('[data-clip]')];
  if (!stops.length) return;

  const tramos = stops.map((stop) =>
    ScrollTrigger.create({ trigger: stop, start: 'top top', end: 'bottom bottom' }),
  );
  const cortes = stops.map((stop) => ScrollTrigger.create({ trigger: stop, start: 'top center' }));
  const ready = clips.map(() => false);
  let active = 0;
  let shown = -1;
  let time = 0;

  const show = (index: number, video: boolean) => {
    const key = video ? index : -1 - index;
    if (key === shown) return;
    shown = key;
    posters.forEach((poster, i) => poster.classList.toggle('opacity-0', i !== index));
    clips.forEach((clip, i) => clip.classList.toggle('opacity-100', video && i === index));
  };

  const sync = () => {
    const clip = clips[active];
    if (!clip || !ready[active]) return show(active, false);
    if (clip.seeking) return;
    if (Math.abs(clip.currentTime - time) > 0.02) clip.currentTime = time;
    else show(active, true);
  };

  clips.forEach((clip, i) =>
    clip.addEventListener('seeked', () => {
      if (i === active) sync();
    }),
  );

  const render = () => {
    const y = window.scrollY;
    active = Math.max(
      0,
      cortes.findLastIndex((corte) => y >= corte.start),
    );
    const tramo = tramos[active];
    if (!tramo) return;
    const progress = clamp01((y - tramo.start) / (tramo.end - tramo.start || 1));
    const clip = clips[active];
    if (clip && ready[active]) time = Math.min(progress * clip.duration, clip.duration - 0.05);
    sync();
  };

  ScrollTrigger.create({
    trigger: world,
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: render,
    onRefresh: render,
  });
  render();

  // Con movimiento reducido o ahorro de datos se quedan los pósters.
  const saveData = (navigator as Navigator & { connection?: Connection }).connection?.saveData;
  if (!clips.length || reduceMotion || saveData) return;

  // De uno en uno: primero el clip de la parada actual y después el más cercano.
  const pending = clips.map((_, i) => i);

  const loadNext = async () => {
    pending.sort((a, b) => Math.abs(a - active) - Math.abs(b - active));
    const i = pending.shift();
    const clip = i === undefined ? undefined : clips[i];
    if (i === undefined || !clip) return;
    const src = clip.dataset.src ?? '';

    // Entero como blob para que el scrub no dependa de la red.
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(res.statusText);
      clip.src = URL.createObjectURL(await res.blob());
    } catch {
      clip.src = src;
    }

    const loaded = await new Promise<boolean>((resolve) => {
      clip.addEventListener('loadeddata', () => resolve(true), { once: true });
      clip.addEventListener('error', () => resolve(false), { once: true });
    });

    if (loaded) {
      // iOS no pinta los fotogramas buscados hasta que el vídeo se ha reproducido una vez.
      await clip.play().catch(() => {});
      clip.pause();
      ready[i] = true;
      render();
    }
    loadNext();
  };

  if (document.readyState === 'complete') loadNext();
  else window.addEventListener('load', () => loadNext(), { once: true });
}
