// Aplikasi Express: API + halaman web (folder public).
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');
const express = require('express');
const { akunAdmin, kontakPengembang, baseUrl } = require('./config');
const { ValidasiError } = require('./lib/validasi');
const { hariIni } = require('./lib/waktu');
const layananBarang = require('./services/barang');
const layananStok = require('./services/stok');
const layananJadwal = require('./services/jadwal');
const layananTransaksi = require('./services/transaksi');
const layananMeja = require('./services/meja');
const { ipLan } = require('./lib/jaringan');

/** Bandingkan teks tanpa bocor waktu (cegah tebak kata sandi lewat lama respons). */
function samaAman(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Alamat dasar yang bisa dibuka HP pembeli, untuk isi QR. */
function alamatDasar(req) {
  if (baseUrl) return baseUrl;
  // req.host (Express 5) ikut membaca X-Forwarded-Host dari proxy/tunnel (trust proxy).
  const host = req.host || req.get('host') || 'localhost';
  const [nama, port] = host.split(':');
  const lokal = ['localhost', '127.0.0.1', '[::1]'].includes(nama);
  const ip = lokal ? ipLan() : null;
  return `${req.protocol}://${ip || nama}${port ? ':' + port : ''}`;
}

function buatApp(db) {
  const barang = layananBarang(db);
  const stok = layananStok(db, barang);
  const jadwal = layananJadwal(db);
  const meja = layananMeja(db);
  const transaksi = layananTransaksi(db, barang, stok, { meja, jadwal });

  const app = express();
  // Di hosting (Render, tunnel) aplikasi berada di belakang proxy HTTPS:
  // percayai satu lapis proxy supaya req.protocol = https (dipakai untuk isi QR).
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  // Pengguna aktif dikirim lewat header X-Pengguna-Id (dipilih di layar awal).
  // Pencatat (id_pengguna) SELALU diambil dari sini, tidak pernah dari isian form.
  const qPengguna = db.prepare('SELECT * FROM PENGGUNA WHERE id_pengguna = ?');
  function wajibPengguna(req, _res, next) {
    const id = Number(req.get('X-Pengguna-Id'));
    const p = id ? qPengguna.get(id) : null;
    if (!p) return next(new ValidasiError('Pilih pengguna dulu (Bu Mimin / Bu Sri).', 'pengguna', 401));
    req.pengguna = p;
    next();
  }
  const wajibAdminUntuk = (aksi) => (req, _res, next) => {
    if (req.pengguna.peran !== 'admin') return next(new ValidasiError(`Hanya admin yang boleh ${aksi}.`, 'pengguna', 403));
    next();
  };
  const wajibAdmin = wajibAdminUntuk('mengubah jadwal buka tutup');

  const api = express.Router();

  api.get('/info', (_req, res) => res.json({ hari_ini: hariIni(), versi: '0.2.0-sprint2', kontak: kontakPengembang }));
  api.get('/pengguna', (_req, res) => res.json(db.prepare('SELECT * FROM PENGGUNA ORDER BY id_pengguna').all()));

  // ---------- MASUK (login admin) ----------
  // Email & kata sandi dicocokkan dengan .env (lihat config.akunAdmin).
  api.post('/masuk', (req, res) => {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const sandi = typeof body.kata_sandi === 'string' ? body.kata_sandi : '';
    if (!email) throw new ValidasiError('Email wajib diisi.', 'email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidasiError('Format email tidak valid.', 'email');
    if (!sandi) throw new ValidasiError('Kata sandi wajib diisi.', 'kata_sandi');
    const cocok = email === akunAdmin.email && samaAman(sandi, akunAdmin.kataSandi);
    if (!cocok) throw new ValidasiError('Email atau kata sandi salah.', 'kata_sandi', 401);
    const admin = db.prepare("SELECT * FROM PENGGUNA WHERE peran = 'admin' ORDER BY id_pengguna LIMIT 1").get();
    if (!admin) throw new ValidasiError('Akun admin belum ada di database.', 'email', 500);
    res.json({ pengguna: admin });
  });

  // ---------- BARANG / daftar sisa stok ----------
  api.get('/barang', (req, res) => res.json(barang.daftar({ q: req.query.q, semua: req.query.semua === '1' })));
  api.get('/barang/:id', (req, res) => res.json(barang.ambilWajib(req.params.id)));
  api.post('/barang', wajibPengguna, (req, res) => res.status(201).json(barang.tambah(req.body || {}, req.pengguna.id_pengguna)));
  api.patch('/barang/:id', wajibPengguna, (req, res) => res.json(barang.ubah(req.params.id, req.body || {})));

  // ---------- STOK (EP-01 US-02) ----------
  api.post('/stok/masuk', wajibPengguna, (req, res) => res.status(201).json(stok.catatMasuk(req.body || {}, req.pengguna.id_pengguna)));
  api.post('/stok/keluar', wajibPengguna, (req, res) => res.status(201).json(stok.catatKeluar(req.body || {}, req.pengguna.id_pengguna)));
  api.get('/stok/riwayat', (req, res) => res.json(stok.riwayat({ id_barang: req.query.id_barang, tanggal: req.query.tanggal, limit: req.query.limit })));

  // ---------- JADWAL (EP-01 US-03) ----------
  api.get('/jadwal', (req, res) => res.json(jadwal.rentang(req.query.dari || hariIni(), req.query.hari || 8)));
  api.get('/jadwal/:tanggal', (req, res) => res.json({ tanggal: req.params.tanggal, jadwal: jadwal.ambil(req.params.tanggal) }));
  api.put('/jadwal/:tanggal', wajibPengguna, wajibAdmin, (req, res) =>
    res.json(jadwal.simpan(req.params.tanggal, req.body || {}, req.pengguna.id_pengguna))
  );

  // ---------- TRANSAKSI (EP-02 US-05) ----------
  api.post('/transaksi', wajibPengguna, (req, res) => res.status(201).json(transaksi.simpan(req.body || {}, req.pengguna.id_pengguna)));
  api.get('/transaksi', (req, res) => res.json(transaksi.logHarian(req.query.tanggal || hariIni())));
  api.get('/transaksi/antrean', wajibPengguna, (_req, res) => res.json(transaksi.antrean()));
  // ?tanggal=YYYY-MM-DD (satu hari) atau ?dari=...&sampai=... (mingguan / bulanan)
  api.get('/transaksi/terlaris', (req, res) => {
    const { tanggal, dari, sampai } = req.query;
    const awal = dari || tanggal || hariIni();
    res.json(transaksi.terlaris({ dari: awal, sampai: sampai || awal }));
  });
  api.patch('/transaksi/:id/status', wajibPengguna, (req, res) => res.json(transaksi.ubahStatus(req.params.id, req.body || {}, req.pengguna.id_pengguna)));
  api.get('/transaksi/:id', (req, res) => {
    const t = transaksi.ambil(req.params.id);
    if (!t) throw new ValidasiError('Transaksi tidak ditemukan.', 'id', 404);
    res.json(t);
  });

  // ---------- MEJA & QR (admin) ----------
  const adminMeja = [wajibPengguna, wajibAdminUntuk('mengelola meja')];
  api.get('/meja', ...adminMeja, (req, res) => {
    const dasar = alamatDasar(req);
    res.json({ alamat_dasar: dasar, meja: meja.daftar().map((m) => ({ ...m, link: `${dasar}/m/${m.kode}` })) });
  });
  api.post('/meja', ...adminMeja, (req, res) => res.status(201).json(meja.tambah(req.body || {})));
  api.patch('/meja/:id', ...adminMeja, (req, res) => res.json(meja.ubah(req.params.id, req.body || {})));
  api.post('/meja/:id/kode-baru', ...adminMeja, (req, res) => res.json(meja.kodeBaru(req.params.id)));

  // ---------- PEMBELI (tanpa login) ----------
  // Tamu & pembeli memakai GET /barang dan /jadwal (publik) untuk menu, stok, dan jadwal.
  const pub = express.Router();
  pub.get('/status', (_req, res) => res.json(jadwal.bukaSekarang()));
  pub.get('/meja/:kode', (req, res) => {
    const m = meja.dariKode(req.params.kode);
    res.json({ nama_meja: m.nama_meja });
  });
  pub.post('/meja/:kode/pesanan', (req, res) => res.status(201).json(transaksi.pesanDariMeja(req.params.kode, req.body || {})));
  pub.get('/pesanan/:kode', (req, res) => res.json(transaksi.pesananPembeli(req.params.kode)));
  pub.post('/bayar/:kode', (req, res) => res.json(transaksi.bayar(req.params.kode)));
  api.use('/publik', pub);

  app.use('/api', api);

  // ---------- Gambar QR (SVG) ----------
  async function kirimQr(res, isi) {
    const svg = await QRCode.toString(isi, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#13233a', light: '#ffffff' } });
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
  }
  app.get('/qr/meja/:kode.svg', async (req, res) => {
    const m = meja.dariKode(req.params.kode);
    await kirimQr(res, `${alamatDasar(req)}/m/${m.kode}`);
  });
  app.get('/qr/bayar/:kode.svg', async (req, res) => {
    const t = transaksi.dariKodeBayar(req.params.kode);
    await kirimQr(res, `${alamatDasar(req)}/bayar/${t.kode_bayar}`);
  });

  // ---------- Halaman ----------
  // Pembeli: / (tamu), /m/<kode> (pembeli di meja), /bayar/<kode> (simulasi QRIS).
  // Admin: /admin (halaman admin.html).
  const halamanPembeli = path.join(__dirname, '..', 'public', 'index.html');
  app.get(['/m/:kode', '/bayar/:kode'], (_req, res) => res.sendFile(halamanPembeli));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Alamat API tidak ditemukan.' }));

  // Halaman web
  app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

  // Penanganan error: pesan validasi dikirim apa adanya; error lain disamarkan.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ValidasiError) return res.status(err.status).json({ error: err.message, field: err.field });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Data yang dikirim tidak valid.' });
    if (err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Data ditolak karena melanggar aturan database.', detail: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan di server.' });
  });

  return app;
}

module.exports = { buatApp };
