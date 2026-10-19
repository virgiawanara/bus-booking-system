import { buildWaLink } from './wa-template';

const TZ = 'Asia/Jakarta';

export function fmtDate(d: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  }).format(typeof d === 'string' ? new Date(d) : d);
}

export function fmtDateTime(d: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  }).format(typeof d === 'string' ? new Date(d) : d);
}

export { formatIDR as fmtIDR } from './wa-template';

export function waPhoneLink(phone: string, text: string): string {
  return buildWaLink(phone, text);
}
