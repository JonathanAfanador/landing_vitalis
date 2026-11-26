const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

// $ 45.900
export const formatoCOP = (valor: number) => cop.format(valor);

// Deja solo los 10 dígitos colombianos: quita espacios, guiones y el indicativo +57.
export const normalizarTelefono = (telefono: string) => {
  const digitos = telefono.replace(/\D/g, '');
  return digitos.length === 12 && digitos.startsWith('57') ? digitos.slice(2) : digitos;
};
