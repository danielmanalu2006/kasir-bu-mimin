// Semua pengaturan dibaca dari berkas .env (bukan ditulis di dalam kode).
// Salin .env.example menjadi .env lalu sesuaikan.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const root = path.join(__dirname, '..');

module.exports = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  // ':memory:' dipakai saat pengujian otomatis
  dbFile:
    process.env.DB_FILE === ':memory:'
      ? ':memory:'
      : path.resolve(root, process.env.DB_FILE || 'data/warung.db'),
  timeZone: process.env.APP_TZ || 'Asia/Jakarta',
  // Alamat yang dipakai di dalam QR (mis. http://192.168.1.5:3000). Kosong =
  // otomatis: di Render memakai RENDER_EXTERNAL_URL (diisi Render sendiri),
  // di laptop dari alamat yang dibuka admin (localhost diganti IP Wi-Fi laptop).
  baseUrl: (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || '').trim().replace(/\/+$/, ''),
  // Akun masuk admin. Disimpan di .env, bukan di tabel, karena ERD revisi
  // belum punya kolom email/kata sandi. Nilai cadangan = contoh di .env.example.
  akunAdmin: {
    email: (process.env.ADMIN_EMAIL || 'dapoerbumimin@gmail.com').trim().toLowerCase(),
    kataSandi: process.env.ADMIN_KATA_SANDI || 'dapoeradmin123',
  },
  // Kontak tim pengembang untuk tombol "Hubungi Tim Pengembang" di Pusat Bantuan.
  // Kosongkan bila belum ada; tombol akan memberi tahu bahwa kontak belum diatur.
  kontakPengembang: {
    email: (process.env.KONTAK_EMAIL || '').trim(),
    whatsapp: (process.env.KONTAK_WA || '').replace(/[^\d]/g, ''),
  },
};
