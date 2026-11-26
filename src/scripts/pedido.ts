import { actions, isInputError } from 'astro:actions';
import { alCambiar, cambiarCantidad, leerCarrito, vaciarCarrito } from './cart';
import { formatoCOP } from '../lib/formato';
import { enlaceWhatsApp, mensajePedido } from '../lib/whatsapp';

type Resumen = NonNullable<Awaited<ReturnType<typeof actions.carrito.resumen>>['data']>;

const elemento = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Falta ${selector} en la página de pedido`);
  return el;
};

const vacio = elemento('[data-vacio]');
const contenido = elemento('[data-contenido]');
const lista = elemento<HTMLUListElement>('[data-lineas]');
const plantilla = elemento<HTMLTemplateElement>('[data-plantilla-linea]');
const total = elemento('[data-total]');
const errorResumen = elemento('[data-error-resumen]');
const form = elemento<HTMLFormElement>('[data-form-pedido]');
const bloqueFormula = elemento('[data-bloque-formula]');
const casillaFormula = elemento<HTMLInputElement>('input[name="declaraFormula"]');
const errorGeneral = elemento('[data-error-general]');
const enviar = elemento<HTMLButtonElement>('[data-enviar]');
const exito = elemento('[data-exito]');

let resumen: Resumen | null = null;

const poner = (li: Element, campo: string, texto: string) => {
  const el = li.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
  if (el) el.textContent = texto;
};

function pintar(datos: Resumen) {
  const filas = leerCarrito().map(({ slug, cantidad }) => {
    const li = plantilla.content.firstElementChild?.cloneNode(true) as HTMLElement;
    li.dataset.slug = slug;
    const linea = datos.lineas.find((l) => l.slug === slug);
    const problema = datos.problemas.find((p) => p.slug === slug);
    const nombre = linea?.nombre ?? 'Medicamento no disponible';

    poner(li, 'nombre', nombre);
    poner(li, 'cantidad', String(cantidad));
    poner(li, 'precio', linea ? `${formatoCOP(linea.precioUnitarioCop)} c/u` : '');
    poner(li, 'subtotal', linea ? formatoCOP(linea.subtotalCop) : '');
    poner(
      li,
      'problema',
      problema?.motivo === 'no-disponible'
        ? 'Ya no está disponible. Quítalo para continuar.'
        : problema?.motivo === 'sin-stock'
          ? `Solo quedan ${problema.disponible}. Ajusta la cantidad.`
          : '',
    );
    li.querySelector<HTMLElement>('[data-campo="cantidad-control"]')?.toggleAttribute('hidden', !linea);

    for (const [accion, etiqueta] of [
      ['menos', `Quitar una unidad de ${nombre}`],
      ['mas', `Agregar una unidad de ${nombre}`],
      ['quitar', `Quitar ${nombre} del pedido`],
    ] as const) {
      li.querySelector(`[data-accion="${accion}"]`)?.setAttribute('aria-label', etiqueta);
    }
    const mas = li.querySelector<HTMLButtonElement>('[data-accion="mas"]');
    if (mas && linea) mas.disabled = cantidad >= Math.min(linea.stock, 99);
    return li;
  });

  lista.replaceChildren(...filas);
  lista.setAttribute('aria-busy', 'false');
  total.textContent = formatoCOP(datos.totalCop);
  bloqueFormula.hidden = !datos.requiereFormula;
  casillaFormula.required = datos.requiereFormula;
  enviar.disabled = datos.problemas.length > 0;
  errorResumen.textContent = '';
}

async function actualizar() {
  const items = leerCarrito();
  vacio.hidden = items.length > 0;
  contenido.hidden = items.length === 0;
  if (!items.length) return;

  lista.setAttribute('aria-busy', 'true');
  const { data, error } = await actions.carrito.resumen({ items });
  if (error) {
    errorResumen.textContent = 'No pudimos actualizar los precios. Revisa tu conexión y recarga la página.';
    enviar.disabled = true;
    return;
  }
  resumen = data;
  pintar(data);
}

let pendiente: number | undefined;
const actualizarPronto = () => {
  window.clearTimeout(pendiente);
  pendiente = window.setTimeout(actualizar, 250);
};

lista.addEventListener('click', (event) => {
  const boton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-accion]');
  const slug = boton?.closest<HTMLElement>('li')?.dataset.slug;
  if (!boton || !slug) return;
  const actual = leerCarrito().find((i) => i.slug === slug)?.cantidad ?? 0;
  const accion = boton.dataset.accion;
  cambiarCantidad(slug, accion === 'quitar' ? 0 : accion === 'mas' ? actual + 1 : actual - 1);
});

// Errores junto a cada campo.
function mostrarErrores(errores: Record<string, string | undefined>) {
  form.querySelectorAll<HTMLElement>('[data-error]').forEach((p) => {
    const nombre = p.dataset.error ?? '';
    const mensaje = errores[nombre] ?? '';
    p.textContent = mensaje;
    const control = form.elements.namedItem(nombre);
    if (control instanceof HTMLElement) control.toggleAttribute('aria-invalid', Boolean(mensaje));
  });
  const primero = Object.keys(errores).find((nombre) => errores[nombre]);
  const campoConError = primero ? form.elements.namedItem(primero) : null;
  if (campoConError instanceof HTMLElement) campoConError.focus();
}

function validarEnNavegador() {
  const errores: Record<string, string> = {};
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) || el.validity.valid) continue;
    errores[el.name] = el.validity.valueMissing
      ? el.type === 'checkbox'
        ? 'Marca esta casilla para continuar.'
        : 'Este campo es obligatorio.'
      : el.type === 'email'
        ? 'Revisa el correo, parece incompleto.'
        : el.validationMessage;
  }
  return errores;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorGeneral.textContent = '';
  const erroresLocales = validarEnNavegador();
  mostrarErrores(erroresLocales);
  if (Object.keys(erroresLocales).length || !resumen) return;

  const fd = new FormData(form);
  const texto = (nombre: string) => String(fd.get(nombre) ?? '');
  enviar.disabled = true;
  enviar.textContent = 'Enviando pedido…';

  const { data, error } = await actions.pedidos.crear({
    nombre: texto('nombre'),
    telefono: texto('telefono'),
    email: texto('email'),
    direccion: texto('direccion'),
    municipio: texto('municipio'),
    notas: texto('notas'),
    declaraFormula: fd.has('declaraFormula'),
    aceptaDatos: fd.has('aceptaDatos') as true,
    sitioWeb: texto('sitioWeb'),
    items: leerCarrito(),
  });

  enviar.disabled = false;
  enviar.textContent = 'Enviar pedido';

  if (error) {
    if (isInputError(error)) {
      mostrarErrores(Object.fromEntries(Object.entries(error.fields).map(([k, v]) => [k, v?.[0]])));
      if (error.fields.items) errorGeneral.textContent = 'Revisa los medicamentos de tu pedido.';
    } else {
      errorGeneral.textContent = error.message || 'No pudimos enviar el pedido. Inténtalo de nuevo.';
      if (error.code === 'CONFLICT') actualizar();
    }
    return;
  }

  vaciarCarrito();
  contenido.hidden = true;
  vacio.hidden = true;
  elemento('[data-exito-codigo]').textContent = data.codigo;
  elemento('[data-exito-total]').textContent = formatoCOP(data.totalCop);
  const whatsapp = enlaceWhatsApp(exito.dataset.whatsapp || null, mensajePedido(data));
  const boton = elemento<HTMLAnchorElement>('[data-exito-whatsapp]');
  if (whatsapp) {
    boton.href = whatsapp;
    boton.hidden = false;
  }
  exito.hidden = false;
  elemento('[data-exito-titulo]').focus();
});

alCambiar(() => {
  if (exito.hidden) actualizarPronto();
});
actualizar();
