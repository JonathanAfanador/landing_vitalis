import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { initWorld } from './world';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initSmoothScroll() {
  if (reduceMotion) return;
  const lenis = new Lenis({ anchors: { offset: -80 } });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  document.addEventListener('scroll:lock', () => lenis.stop());
  document.addEventListener('scroll:unlock', () => lenis.start());
}

// Cada sección aparece una sola vez al entrar en pantalla.
function initReveals() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -10% 0px' },
  );
  document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
}

// Las palabras del tagline se encienden una a una, en orden de lectura, según avanza el scroll.
function initTagline() {
  const tagline = document.querySelector<HTMLElement>('[data-tagline]');
  if (!tagline || reduceMotion) return;
  const words = [...tagline.querySelectorAll('.tagline-word')];
  ScrollTrigger.create({
    trigger: tagline,
    start: 'top 80%',
    end: 'bottom 45%',
    onUpdate: ({ progress }) => {
      const on = Math.round(progress * words.length);
      words.forEach((word, i) => word.classList.toggle('is-on', i < on));
    },
  });
}

// Marca en el menú la sección que se está viendo.
function initCurrentNav() {
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-nav]')];
  const byId = new Map(links.map((link) => [link.hash.slice(1), link]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const link = byId.get(entry.target.id);
        if (link) link.setAttribute('aria-current', String(entry.isIntersecting));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  byId.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) observer.observe(section);
  });
}

initSmoothScroll();
initReveals();
initTagline();
initCurrentNav();
const world = document.querySelector<HTMLElement>('[data-world]');
if (world) initWorld(world, reduceMotion);
