# Kasir & Stok Warung Kampus — Kelompok 7

Prototype Sprint 2 (yang tertinggal), dikerjakan urut sesuai arahan PM:

| Task | User story | Isi | Halaman di aplikasi |
|---|---|---|---|
| Task 1 | EP-01 US-02 | Stok masuk, stok keluar (tidak boleh negatif), daftar sisa stok | menu **Stok** |
| Task 2 | EP-01 US-03 | Jadwal buka tutup per hari + validasi jam | menu **Jadwal** |
| Task 3 | EP-02 US-05 | Pesanan, QRIS/tunai, stok berkurang otomatis, log penjualan, < 30 detik | menu **Kasir** + Lainnya › Log penjualan |

Database mengikuti **ERD revisi EP-01 US-01 (disetujui BA 26 Okt 2026)**: 7 tabel. Tambahan dari desain (Nov 2026 — **perlu dikabarkan ke BA**): kolom opsional `nama_pelanggan` dan `catatan` di `TRANSAKSI` (halaman Kasir), dan `catatan` di `STOK_KELUAR` (halaman Stok), serta `status` (belum_selesai / selesai / dibatalkan) dan `uang_diterima` di `TRANSAKSI` (halaman Transaksi). Untuk sisi pembeli: tabel baru **`MEJA`** (kode QR acak) dan kolom `id_meja`, `status_bayar`, `kode_bayar` di `TRANSAKSI`; pesanan dari meja tercatat atas nama admin (pemilik warung) karena pembeli tidak punya akun. Pesanan baru berstatus Belum Selesai; membatalkan pesanan mengembalikan stok (tercatat di riwayat stok) dan tidak dihitung sebagai pemasukan. Transaksi lama dianggap Selesai. `STOK_MASUK.tanggal_masuk` kini terisi otomatis tanggal + jam (form Stok Masuk tidak punya isian tanggal). Database lama otomatis ditambah kolomnya saat aplikasi dijalankan, data lama tetap aman. Lihat `src/schema.sql`.

## Cara menjalankan

Butuh **Node.js 22 atau lebih baru** (cek: `node -v`; unduh versi LTS dari nodejs.org bila masih versi lama).

```bash
npm install          # sekali saja (ulangi setelah git pull bila ada paket baru, mis. qrcode)
cp .env.example .env # Windows: copy .env.example .env
npm start
```

Terminal akan menampilkan alamatnya:

- `Admin  : http://localhost:3000/admin` — halaman admin (login Bu Mimin)
- `Pembeli: http://localhost:3000` — halaman pembeli; tanpa QR masuk sebagai **tamu**
- `HP     : http://192.168.x.x:3000` — dibuka dari HP (**HP dan laptop harus di Wi-Fi yang sama**). IP yang ditandai "dipakai di QR" otomatis masuk ke QR meja.

### Sisi pembeli (tanpa login)

| Pembeli | Masuk lewat | Bisa |
|---|---|---|
| Tamu | buka alamat utama tanpa scan QR | lihat jadwal buka & sisa stok menu |
| Pembeli di meja | scan QR meja (`/m/<kode acak>`) | lihat jadwal & stok, **memesan**, bayar QRIS |

- QR meja dicetak dari **Admin › Lainnya › Kelola meja & QR** (5 meja awal; bisa tambah, nonaktifkan, atau ganti kode bila QR tersebar).
- Pesanan hanya bisa dikirim saat warung **buka menurut jadwal**. Nama pemesan wajib diisi. Stok langsung berkurang, dan pesanan muncul di Transaksi admin dengan label meja dan status **Belum Dibayar** (halaman Transaksi menyegarkan diri tiap 10 detik).
- **Pembayaran QRIS masih simulasi** (belum ada payment gateway): layar pembeli menampilkan QR; QR itu discan dengan HP lain untuk membuka halaman bayar, lalu tekan **Tandai sudah dibayar**. Untuk demo dengan satu HP ada link "Buka halaman bayar (simulasi)".
- Pesanan meja baru bisa ditandai Selesai setelah dibayar. Pemasukan hanya menghitung pesanan yang sudah dibayar.
- Bila QR berisi alamat yang salah (mis. laptop punya beberapa jaringan), isi `BASE_URL` di `.env`.

Saat pertama dijalankan, database (`data/warung.db`) dibuat otomatis dan diisi data awal. Buka `/admin` → masuk dengan akun admin dari `.env` (`ADMIN_EMAIL` / `ADMIN_KATA_SANDI`; contohnya ada di `.env.example`). Setelah masuk pertama kali, muncul onboarding 5 layar (bisa dilewati). Kontak di tombol **Hubungi Tim Pengembang** (Pusat Bantuan) diatur lewat `KONTAK_WA` / `KONTAK_EMAIL` di `.env`.

> Kalau dari HP tidak bisa dibuka: izinkan Node.js di Windows Firewall (jaringan Private), atau pastikan Wi-Fi kampus tidak memblokir antar-perangkat (pakai hotspot HP sebagai alternatif).

## Perintah lain

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalan + otomatis restart saat kode diubah |
| `npm run db:reset` | Hapus database dan isi ulang data awal |
| `npm test` | Uji mandiri otomatis (70 uji, pakai database sementara, data asli aman) |

## Struktur

```
src/
  schema.sql          tabel sesuai ERD revisi + aturan (CHECK/UNIQUE/FK)
  config.js           baca pengaturan dari .env (bukan di dalam kode)
  db.js               koneksi database
  seed.js             data awal (pengguna, barang CONTOH, jadwal 7 hari)
  app.js              daftar alamat API
  services/
    barang.js         daftar sisa stok, tambah/ubah barang
    stok.js           Task 1: stok masuk & keluar
    jadwal.js         Task 2: jadwal buka tutup
    transaksi.js      Task 3: pesanan & pembayaran
  lib/validasi.js     aturan validasi (dipakai server)
public/               tampilan HP (HTML/CSS/JS biasa, tanpa build)
  index.html          halaman pembeli (tamu / meja / simulasi bayar) — js/pembeli.js
  admin.html          halaman admin — js/main.js
test/api.test.js      uji mandiri otomatis
docs/                 penjelasan, hasil uji, screenshot
```

## Aturan penting yang sudah dipasang

- **Stok tidak bisa negatif** — dicek 3 lapis: di form, di server, dan di database (`CHECK stok_saat_ini >= 0`).
- **Pencatatan stok & transaksi selalu satu paket** (transaksi database). Kalau satu langkah gagal, semuanya dibatalkan.
- **Pencatat otomatis** dari pengguna yang dipilih, bukan diisi manual.
- **Harga transaksi diambil dari database**, lalu disalin ke `harga_satuan`, supaya naik-turun harga tidak mengubah transaksi lama.
- **Satu tanggal = satu jadwal** (`UNIQUE tanggal`). Menyimpan tanggal yang sudah ada berarti mengubah.
- **Jadwal mingguan bawaan** untuk tanggal yang belum diatur: Senin–Jumat 07.00–16.00, Sabtu 08.00–13.00, Minggu tutup (ubah polanya di `src/lib/jadwal-bawaan.js`). Jadwal yang diatur admin selalu diutamakan; tanggal bawaan ditandai **Bawaan** di halaman Jadwal. Pesanan pembeli dicek terhadap jadwal ini.
- **Jam tutup harus setelah jam buka** (jam sama juga ditolak), dicek di form, server, dan database.
- **Nama barang tidak boleh kembar** (tidak peka huruf besar/kecil dan spasi).

## Yang masih perlu dikonfirmasi (bukan bug)

1. **Daftar menu** diambil dari desain Kasir (13 menu). Stok awal mengikuti desain, stok minimum masih perkiraan (5). Ubah di `src/seed.js` (`BARANG_AWAL`) lalu `npm run db:reset`, atau lewat Lainnya › Kelola barang. Uji otomatis memakai data ujinya sendiri, jadi tidak terpengaruh.
2. **QRIS hanya dicatat sebagai metode bayar**, tidak ada integrasi pembayaran.
3. **Uang diterima** (tunai) disimpan bila diisi, jadi kembalian tampil di Detail Transaksi. **Menu terlaris** hanya menghitung pesanan berstatus Selesai, sedangkan **pemasukan** menghitung semua pesanan yang tidak dibatalkan.
4. **Warung tutup lewat tengah malam** belum didukung (aturan jam tutup > jam buka).
5. **Login** hanya untuk admin. Email & kata sandi disimpan di `.env` (ERD belum punya kolomnya). Server masih memercayai header `X-Pengguna-Id` tanpa token sesi, dan "Lupa kata sandi" belum mengirim email. Cukup untuk prototype, perlu diputuskan untuk versi rilis.
6. **Teknologi**: Node.js + Express + SQLite dipilih karena paling ringan dijalankan semua anggota. Kalau tim pakai stack lain, logika & aturan di `src/services/` bisa dipindah apa adanya.
