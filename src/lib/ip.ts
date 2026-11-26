import { createHmac } from 'node:crypto';
import { IP_HASH_SALT } from 'astro:env/server';

// Para el límite de envíos se guarda un hash con sal, nunca la IP.
export const hashIp = (ip: string) => createHmac('sha256', IP_HASH_SALT).update(ip).digest('hex');
