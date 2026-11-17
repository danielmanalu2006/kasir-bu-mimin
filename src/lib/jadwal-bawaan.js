// Jadwal mingguan bawaan: dipakai untuk tanggal yang BELUM diatur admin.
// Jadwal yang diatur di halaman Jadwal selalu diutamakan.
// Ubah pola di sini bila jam operasional rutin warung berubah.
const POLA = {
  0: { buka: false, jam_buka: null, jam_tutup: null, catatan: 'Libur hari Minggu' }, // Minggu
  6: { buka: true, jam_buka: '08:00', jam_tutup: '13:00', catatan: null },          // Sabtu
  hariKerja: { buka: true, jam_buka: '07:00', jam_tutup: '16:00', catatan: null },   // Senin–Jumat
};

/** Jadwal bawaan untuk tanggal 'YYYY-MM-DD'. */
function jadwalBawaan(tanggal) {
  const hari = new Date(`${tanggal}T00:00:00Z`).getUTCDay(); // 0 = Minggu
  return { ...(POLA[hari] || POLA.hariKerja) };
}

module.exports = { jadwalBawaan };
