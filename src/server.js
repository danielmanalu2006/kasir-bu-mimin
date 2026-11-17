// Titik masuk: `npm start`
const { daftarIp } = require('./lib/jaringan');
const config = require('./config');
const { bukaDatabase, masihKosong } = require('./db');
const { isiDataAwal, isiMejaAwal } = require('./seed');
const { buatApp } = require('./app');

const db = bukaDatabase(config.dbFile);
if (masihKosong(db)) {
  isiDataAwal(db);
  console.log('Database baru dibuat dan diisi data awal.');
} else if (db.prepare('SELECT COUNT(*) AS n FROM MEJA').get().n === 0) {
  // Database lama (sebelum ada fitur pembeli): siapkan meja awal untuk QR.
  isiMejaAwal(db);
  console.log('Meja 1–5 ditambahkan untuk pemesanan lewat QR.');
}

const app = buatApp(db);
app.listen(config.port, config.host, () => {
  console.log(`\nKasir & Stok Warung Kampus berjalan.`);
  console.log(`  Admin  : http://localhost:${config.port}/admin`);
  console.log(`  Pembeli: http://localhost:${config.port}  (tamu; pembeli di meja masuk lewat QR)`);
  // Alamat untuk dibuka dari HP (HP dan laptop harus di Wi-Fi yang sama). Yang pertama dipakai di QR.
  daftarIp().forEach((n, i) => console.log(`  HP     : http://${n.alamat}:${config.port}  (${n.nama}${i === 0 ? ', dipakai di QR' : ''})`));
  console.log(`  Database: ${config.dbFile}\n`);
});
