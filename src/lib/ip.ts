import { createHmac } from 'node:crypto';
import { IP_HASH_SALT } from 'astro:env/server';

// HMAC con sal y un prefijo por uso: nunca se guarda la IP ni el correo en claro.
const hmac = (uso: string, valor: string) =>
  createHmac('sha256', IP_HASH_SALT).update(`${uso}:${valor}`).digest('hex');

export const hashIp = (ip: string) => hmac('ip', ip);
export const hashCorreo = (email: string) => hmac('correo', email.trim().toLowerCase());
