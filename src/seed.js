// Data awal: 2 pengguna, daftar barang contoh, dan jadwal 7 hari ke depan.
//
// Daftar menu diambil dari desain halaman Kasir (Dapoer Bu Mimin).
// Stok awal mengikuti angka di desain; stok minimum belum ada di desain
// (sementara 5, tempe/tahu 10) — sesuaikan dengan Bu Mimin bila perlu.
// Setelah mengubah BARANG_AWAL, jalankan `npm run db:reset`.

const { hariIni, tambahHari, sekarang } = require('./lib/waktu');
const { kodeAcak } = require('./lib/kode');
const { jadwalBawaan } = require('./lib/jadwal-bawaan');

// Meja awal; QR tiap meja bisa dicetak dari Lainnya › Kelola meja & QR.
const JUMLAH_MEJA_AWAL = 5;

const PENGGUNA_AWAL = [
  { nama: 'Bu Mimin', peran: 'admin' },
  { nama: 'Bu Sri', peran: 'pegawai' },
];

// [nama, satuan, harga_jual, stok_awal, stok_minimum]
const BARANG_AWAL = [
  ['Nasi Campur', 'porsi', 15000, 14, 5],
  ['Nasi Lalapan / Penyetan', 'porsi', 15000, 12, 5],
  ['Nasi Rawon', 'porsi', 16000, 8, 5],
  ['Nasi Bakar', 'porsi', 11000, 18, 5],
  ['Nasi Putih', 'porsi', 5000, 18, 5],
  ['Ayam Bakar', 'potong', 10000, 9, 5],
  ['Ayam Laos', 'potong', 10000, 11, 5],
  ['Ayam Krispi', 'potong', 10000, 15, 5],
  ['Udang', 'porsi', 10000, 5, 5],
  ['Jamur Krispi', 'porsi', 8000, 7, 5],
  ['Telur Dadar', 'butir', 5000, 16, 5],
  ['Tempe / Tahu', 'potong', 2000, 28, 10],
  ['Sayur dan semacamnya', 'porsi', 3000, 10, 5],
];

// Jadwal awal 7 hari = jadwal mingguan bawaan (Senin-Jumat 07.00-16.00, Sabtu 08.00-13.00, Minggu libur).
function jadwalUntuk(tanggal) {
  const j = jadwalBawaan(tanggal);
  return { ...j, buka: j.buka ? 1 : 0 };
}

/** Isi data awal. `barang` bisa diganti (dipakai uji otomatis dengan data ujinya sendiri). */
function isiDataAwal(db, { barang = BARANG_AWAL } = {}) {
  const hari = hariIni();
  const run = db.transaction(() => {
    const insUser = db.prepare('INSERT INTO PENGGUNA (nama, peran) VALUES (?, ?)');
    for (const u of PENGGUNA_AWAL) insUser.run(u.nama, u.peran);
    const admin = db.prepare("SELECT id_pengguna FROM PENGGUNA WHERE peran = 'admin' ORDER BY id_pengguna LIMIT 1").get().id_pengguna;

    const insBarang = db.prepare(
      'INSERT INTO BARANG (nama_barang, satuan, harga_jual, stok_saat_ini, stok_minimum, aktif) VALUES (?, ?, ?, ?, ?, 1)'
    );
    const insMasuk = db.prepare(
      'INSERT INTO STOK_MASUK (id_barang, id_pengguna, jumlah, tanggal_masuk, catatan) VALUES (?, ?, ?, ?, ?)'
    );
    for (const [nama, satuan, harga, stok, min] of barang) {
      const { lastInsertRowid } = insBarang.run(nama, satuan, harga, stok, min);
      // Stok awal dicatat sebagai stok masuk, supaya riwayat cocok dengan sisa stok.
      if (stok > 0) insMasuk.run(lastInsertRowid, admin, stok, sekarang(), 'Stok awal');
    }

    isiMejaAwal(db);

    const insJadwal = db.prepare(
      'INSERT INTO JADWAL_BUKA_TUTUP (id_pengguna, tanggal, jam_buka, jam_tutup, buka, catatan) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (let i = 0; i < 7; i++) {
      const t = tambahHari(hari, i);
      const j = jadwalUntuk(t);
      insJadwal.run(admin, t, j.jam_buka, j.jam_tutup, j.buka, j.catatan);
    }
  });
  run();
}

/** Buat meja awal (Meja 1..5) dengan kode QR acak. Dipakai juga untuk database lama yang belum punya meja. */
function isiMejaAwal(db) {
  const insMeja = db.prepare('INSERT INTO MEJA (nama_meja, kode, aktif) VALUES (?, ?, 1)');
  for (let i = 1; i <= JUMLAH_MEJA_AWAL; i++) insMeja.run(`Meja ${i}`, kodeAcak(10));
}

module.exports = { isiDataAwal, isiMejaAwal, BARANG_AWAL, PENGGUNA_AWAL };
