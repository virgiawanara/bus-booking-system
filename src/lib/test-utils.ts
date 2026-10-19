// Util waktu kecil untuk test — bukan batu bata aplikasi.
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}

export function hoursFromNow(n: number): Date {
  return new Date(Date.now() + n * 60 * 60 * 1000);
}
