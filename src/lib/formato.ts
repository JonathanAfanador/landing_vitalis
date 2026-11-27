const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// $ 45.900
export const formatoCOP = (valor: number) => cop.format(valor);

// Deja solo los 10 dígitos colombianos: quita espacios, guiones y el indicativo +57.
export const normalizarTelefono = (telefono: string) => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 12 && digitos.startsWith('57') ? digitos.slice(2) : digitos;
};

// 310 555 1234 (celular) o 601 234 5678 (fijo), a partir de los 10 dígitos ya normalizados.
export const formatoTelefono = (telefono: string) => telefono.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1 $2 $3');

// "miércoles, 2 de diciembre" a partir de una fecha sin hora (YYYY-MM-DD), sin que la zona horaria la mueva.
const diaMes = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});
export const formatoFecha = (fecha: string) => diaMes.format(new Date(`${fecha}T00:00:00Z`));

// La tabla de especies guarda el nombre en plural ("Perros"); en una cita se habla de una sola mascota.
export const nombreEspecie = (slug: string) => {
  const texto = slug.replaceAll('-', ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};
