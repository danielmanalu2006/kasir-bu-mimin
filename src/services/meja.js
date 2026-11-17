// Meja + kode QR. Pembeli yang men-scan QR meja masuk sebagai pembeli di meja itu.
const v = require('../lib/validasi');
const { kodeAcak, kodeValid } = require('../lib/kode');

function rapikan(m) {
  return m ? { ...m, aktif: !!m.aktif } : m;
}

module.exports = function layananMeja(db) {
  const qId = db.prepare('SELECT * FROM MEJA WHERE id_meja = ?');
  const qKode = db.prepare('SELECT * FROM MEJA WHERE kode = ?');

  function daftar() {
    return db.prepare('SELECT * FROM MEJA ORDER BY id_meja').all().map(rapikan);
  }

  function ambilWajib(id) {
    const m = qId.get(Number(id));
    if (!m) throw new v.ValidasiError('Meja tidak ditemukan.', 'id_meja', 404);
    return rapikan(m);
  }

  /** Meja AKTIF dari kode QR; kode salah/meja nonaktif → 404 (QR tidak berlaku). */
  function dariKode(kode) {
    const m = kodeValid(kode) ? qKode.get(kode) : null;
    if (!m || !m.aktif) throw new v.ValidasiError('QR meja tidak dikenali atau sudah tidak berlaku. Minta QR terbaru ke kasir.', 'kode', 404);
    return rapikan(m);
  }

  function kodeUnik() {
    for (let i = 0; i < 5; i++) {
      const k = kodeAcak(10);
      if (!qKode.get(k)) return k;
    }
    throw new Error('Gagal membuat kode meja unik.');
  }

  function cekNama(nama, kecualiId = null) {
    const ada = db.prepare('SELECT id_meja FROM MEJA WHERE nama_meja = ? COLLATE NOCASE AND id_meja IS NOT ?').get(nama, kecualiId);
    if (ada) throw new v.ValidasiError(`Meja bernama "${nama}" sudah ada.`, 'nama_meja', 409);
  }

  function tambah(input) {
    const nama = v.teksWajib(input.nama_meja, 'nama_meja', 'Nama meja', 30);
    cekNama(nama);
    const { lastInsertRowid } = db.prepare('INSERT INTO MEJA (nama_meja, kode, aktif) VALUES (?, ?, 1)').run(nama, kodeUnik());
    return ambilWajib(lastInsertRowid);
  }

  function ubah(id, input) {
    const lama = ambilWajib(id);
    const nama = input.nama_meja !== undefined ? v.teksWajib(input.nama_meja, 'nama_meja', 'Nama meja', 30) : lama.nama_meja;
    const aktif = input.aktif !== undefined ? (input.aktif ? 1 : 0) : (lama.aktif ? 1 : 0);
    cekNama(nama, lama.id_meja);
    db.prepare('UPDATE MEJA SET nama_meja = ?, aktif = ? WHERE id_meja = ?').run(nama, aktif, lama.id_meja);
    return ambilWajib(lama.id_meja);
  }

  /** Ganti kode QR (mis. QR lama tersebar). QR lama langsung tidak berlaku. */
  function kodeBaru(id) {
    const lama = ambilWajib(id);
    db.prepare('UPDATE MEJA SET kode = ? WHERE id_meja = ?').run(kodeUnik(), lama.id_meja);
    return ambilWajib(lama.id_meja);
  }

  return { daftar, ambilWajib, dariKode, tambah, ubah, kodeBaru };
};
