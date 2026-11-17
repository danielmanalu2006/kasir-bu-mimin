# Deploy demo ke Render (gratis)

Aplikasi sudah disiapkan untuk Render lewat berkas [`render.yaml`](../render.yaml) di root proyek.

## Sebelum mulai

- Kode terbaru (termasuk `render.yaml`) sudah di-push ke GitHub, branch `main`.
- Punya akun Render (daftar di render.com, bisa masuk dengan akun GitHub).

## Langkah

1. Di dashboard Render, pilih **New → Blueprint**.
2. Hubungkan akun GitHub, lalu pilih repo `kasir-stok-warung-kampus`.
3. Render membaca `render.yaml` dan menampilkan satu layanan: **dapoer-bu-mimin** (Web Service, paket Free, region Singapore).
4. Render meminta nilai **`ADMIN_KATA_SANDI`**. Isi dengan kata sandi admin untuk demo (jangan pakai `dapoeradmin123` karena tertulis di repo).
5. Tekan **Apply / Deploy Blueprint**. Tunggu sampai log menampilkan `Kasir & Stok Warung Kampus berjalan.` dan status menjadi **Live** (beberapa menit).
6. Buka URL yang diberikan Render, misalnya `https://dapoer-bu-mimin.onrender.com`:
   - `https://…onrender.com` → halaman pembeli (tamu)
   - `https://…onrender.com/admin` → halaman admin (email `dapoerbumimin@gmail.com`, kata sandi dari langkah 4)
7. Cetak/scan QR meja dari **Admin › Lainnya › Kelola meja & QR**. QR otomatis berisi alamat `https://…onrender.com/m/<kode>`, jadi bisa discan dari HP mana pun (tidak perlu Wi-Fi yang sama).

Setiap push ke `main` akan memicu deploy ulang otomatis (`autoDeploy: true`).

## Yang perlu diketahui (paket gratis)

| Hal | Akibat untuk demo |
|---|---|
| Tertidur setelah ~15 menit tanpa pengunjung | Buka link beberapa menit sebelum demo supaya "bangun" (pembukaan pertama ~30–60 detik). |
| Disk tidak permanen | Data pesanan/stok yang dicatat **kembali ke data awal** setiap aplikasi restart, tertidur lalu bangun, atau deploy ulang. Data awal (menu, Meja 1–5, jadwal) dibuat otomatis. |
| Kode QR meja berganti setelah restart | Karena database dibuat ulang, kode meja juga baru. **Cetak QR setelah aplikasi bangun di hari demo**, atau tampilkan QR langsung dari layar admin. |
| Jam buka | Pesanan pembeli hanya bisa saat warung buka menurut jadwal (bawaan Senin–Jumat 07.00–16.00, Sabtu 08.00–13.00, Minggu tutup). Untuk demo di luar jam itu, atur jadwal hari ini di Admin › Jadwal. |

## Pengaturan tambahan (opsional)

Di Render: layanan **dapoer-bu-mimin → Environment**:

- `KONTAK_WA` / `KONTAK_EMAIL` — kontak di tombol "Hubungi Tim Pengembang" (Pusat Bantuan).
- `BASE_URL` — hanya bila memakai domain sendiri; kalau kosong, QR memakai URL Render.

## Bila deploy gagal

- Lihat tab **Logs** di Render.
- Pastikan versi Node 22 (sudah diatur lewat `NODE_VERSION` di `render.yaml`).
- `better-sqlite3` sudah membawa file jadi untuk Linux, jadi tidak perlu dikompilasi. Bila log menyebut error modul native, coba **Manual Deploy → Clear build cache & deploy**.
