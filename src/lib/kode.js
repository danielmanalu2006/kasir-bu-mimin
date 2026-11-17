// Kode acak untuk QR meja dan link pembayaran (sulit ditebak).
const crypto = require('crypto');

// Tanpa huruf/angka yang mirip (0/O, 1/l/I) supaya mudah dibaca bila diketik.
const HURUF = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';

function kodeAcak(panjang = 10) {
  const bytes = crypto.randomBytes(panjang);
  let s = '';
  for (let i = 0; i < panjang; i++) s += HURUF[bytes[i] % HURUF.length];
  return s;
}

/** true bila teks hanya berisi huruf/angka kode (mencegah input aneh di URL). */
const kodeValid = (s) => typeof s === 'string' && /^[A-Za-z0-9]{6,40}$/.test(s);

module.exports = { kodeAcak, kodeValid };
