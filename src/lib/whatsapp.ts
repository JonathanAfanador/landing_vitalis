import { contacto } from '../data/vitalis';

// Enlace a WhatsApp con el mensaje ya escrito. `null` mientras no haya número verificado.
export const enlaceWhatsApp = (mensaje: string) =>
  contacto.whatsapp ? `https://wa.me/${contacto.whatsapp}?text=${encodeURIComponent(mensaje)}` : null;
