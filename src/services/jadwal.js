// EP-01 US-03: jadwal buka tutup warung, disimpan PER TANGGAL.
// Tanggal yang belum diatur memakai jadwal mingguan bawaan (src/lib/jadwal-bawaan.js),
// ditandai `bawaan: true`. Jadwal yang diatur admin selalu diutamakan.
const v = require('../lib/validasi');
const { hariIni, sekarang, tambahHari, tanggalValid, jamValid } = require('../lib/waktu');
const { jadwalBawaan } = require('../lib/jadwal-bawaan');

/** Baris database → jadwal; tanggal tanpa baris → jadwal bawaan. */
function rapikan(row, tanggal) {
  if (row) return { ...row, buka: !!row.buka, bawaan: false };
  return { tanggal, ...jadwalBawaan(tanggal), diatur_oleh: null, bawaan: true };
}

module.exports = function layananJadwal(db) {
  const qSatu = db.prepare(
    `SELECT j.*, p.nama AS diatur_oleh FROM JADWAL_BUKA_TUTUP j
     JOIN PENGGUNA p USING (id_pengguna) WHERE tanggal = ?`
  );

  function cekTanggal(tanggal) {
    if (!tanggalValid(tanggal)) throw new v.ValidasiError('Tanggal tidak valid.', 'tanggal');
    return tanggal;
  }

  /** Jadwal satu tanggal (jadwal bawaan bila belum diatur). */
  function ambil(tanggal) {
    cekTanggal(tanggal);
    return rapikan(qSatu.get(tanggal), tanggal);
  }

  /** Jadwal beberapa hari mulai `dari`. Tanggal yang belum diatur memakai jadwal bawaan. */
  function rentang(dari = hariIni(), jumlahHari = 8) {
    cekTanggal(dari);
    const n = Math.min(Math.max(Number(jumlahHari) || 8, 1), 31);
    const sampai = tambahHari(dari, n - 1);
    const rows = db
      .prepare(
        `SELECT j.*, p.nama AS diatur_oleh FROM JADWAL_BUKA_TUTUP j
         JOIN PENGGUNA p USING (id_pengguna) WHERE tanggal BETWEEN ? AND ? ORDER BY tanggal`
      )
      .all(dari, sampai);
    const peta = new Map(rows.map((r) => [r.tanggal, r]));
    return Array.from({ length: n }, (_, i) => {
      const t = tambahHari(dari, i);
      return { tanggal: t, jadwal: rapikan(peta.get(t), t) };
    });
  }

  /**
   * Validasi jadwal (dipakai server; aturan yang sama juga ada di form).
   * - status buka: jam buka & jam tutup wajib, format 24 jam
   * - jam tutup harus SETELAH jam buka (sama persis juga ditolak)
   * - status libur: jam boleh kosong (dan dikosongkan)
   */
  function validasi(input) {
    const buka = input.buka === true || input.buka === 1 || input.buka === '1' || input.buka === 'true';
    const catatan = v.teksOpsional(input.catatan, 200);
    if (!buka) return { buka: 0, jam_buka: null, jam_tutup: null, catatan };

    const jb = input.jam_buka ? String(input.jam_buka).slice(0, 5) : '';
    const jt = input.jam_tutup ? String(input.jam_tutup).slice(0, 5) : '';
    if (!jb) throw new v.ValidasiError('Jam buka wajib diisi bila warung buka.', 'jam_buka');
    if (!jt) throw new v.ValidasiError('Jam tutup wajib diisi bila warung buka.', 'jam_tutup');
    if (!jamValid(jb)) throw new v.ValidasiError('Format jam buka harus 24 jam, misalnya 07:00.', 'jam_buka');
    if (!jamValid(jt)) throw new v.ValidasiError('Format jam tutup harus 24 jam, misalnya 16:00.', 'jam_tutup');
    if (jt === jb) throw new v.ValidasiError('Jam tutup tidak boleh sama dengan jam buka.', 'jam_tutup');
    if (jt < jb) throw new v.ValidasiError('Jam tutup harus setelah jam buka.', 'jam_tutup');
    return { buka: 1, jam_buka: jb, jam_tutup: jt, catatan };
  }

  /**
   * Simpan jadwal satu tanggal. Bila tanggal itu sudah punya jadwal,
   * jadwalnya DIUBAH (bukan digandakan) — dijamin juga oleh UNIQUE(tanggal).
   */
  function simpan(tanggal, input, idPengguna) {
    cekTanggal(tanggal);
    const j = validasi(input);
    const sudahAda = !!qSatu.get(tanggal);
    db.prepare(
      `INSERT INTO JADWAL_BUKA_TUTUP (id_pengguna, tanggal, jam_buka, jam_tutup, buka, catatan)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(tanggal) DO UPDATE SET
         id_pengguna = excluded.id_pengguna,
         jam_buka    = excluded.jam_buka,
         jam_tutup   = excluded.jam_tutup,
         buka        = excluded.buka,
         catatan     = excluded.catatan`
    ).run(idPengguna, tanggal, j.jam_buka, j.jam_tutup, j.buka, j.catatan);
    return { jadwal: ambil(tanggal), diubah: sudahAda };
  }

  /** Apakah warung buka SAAT INI menurut jadwal hari ini (atau jadwal bawaan). Dipakai untuk pesanan pembeli. */
  function bukaSekarang(waktu = sekarang()) {
    const tanggal = waktu.slice(0, 10);
    const jam = waktu.slice(11, 16);
    const j = rapikan(qSatu.get(tanggal), tanggal);
    if (!j.buka) return { buka: false, pesan: 'Warung tutup hari ini.', jadwal: j };
    if (jam < j.jam_buka) return { buka: false, pesan: `Warung belum buka. Buka pukul ${j.jam_buka}.`, jadwal: j };
    if (jam >= j.jam_tutup) return { buka: false, pesan: `Warung sudah tutup (tutup pukul ${j.jam_tutup}).`, jadwal: j };
    return { buka: true, pesan: `Buka sampai pukul ${j.jam_tutup}.`, jadwal: j };
  }

  return { ambil, rentang, simpan, validasi, bukaSekarang };
};
