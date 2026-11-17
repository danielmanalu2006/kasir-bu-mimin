// Pesanan Masuk (#/kasir/pesanan): antrean pesanan yang belum selesai, dari meja
// (pembeli scan QR) maupun dari kasir. Terlama di atas. Memuat ulang tiap 5 detik.
import { api, esc, rupiah, angka, toast, kodePesanan, sekarangWIB } from '../util.js';
import { ikon } from './auth.js';
import { tandaiSelesai, batalkan } from './transaksi.js';
import { ikonAntrean } from './kasir.js';

const FILTER = [['semua', 'Semua'], ['meja', 'Dari Meja'], ['kasir', 'Dari Kasir'], ['bayar', 'Belum Dibayar']];

/** Menit sejak waktu 'YYYY-MM-DD HH:MM:SS' (WIB) sampai sekarang (WIB). */
function menitSejak(waktu) {
  const { tanggal, jam } = sekarangWIB();
  const kini = Date.parse(`${tanggal}T${jam}:00Z`);
  const lalu = Date.parse(`${waktu.replace(' ', 'T')}Z`);
  return Math.max(0, Math.floor((kini - lalu) / 60000));
}
function lamaTunggu(waktu) {
  const m = menitSejak(waktu);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} menit lalu`;
  const j = Math.floor(m / 60);
  if (j < 24) return `${j} jam ${m % 60} menit lalu`;
  return `${Math.floor(j / 24)} hari lalu`;
}

export async function render(app) {
  let filter = 'semua';
  let daftar = [];
  let idSebelumnya = null;
  let tandaTerakhir = '';

  app.innerHTML = `
    <a href="#/kasir" class="btn-kembali">${ikon.kiri} Kembali ke Kasir</a>
    <section class="bantuan-card kasir-hero">
      <span class="bantuan-hero-ikon">${ikonAntrean}</span>
      <h1>Pesanan Masuk</h1>
      <span class="badge-angka besar" id="jumlah" hidden></span>
    </section>
    <p class="trx-catatan-kaki" style="margin-top:-2px">Antrean pesanan yang belum selesai, dari meja maupun kasir. Pesanan terlama ada di atas. Halaman ini memuat ulang otomatis.</p>
    <nav class="antrean-filter" id="filter" aria-label="Saring pesanan">
      ${FILTER.map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${k === filter}">${l}<span class="num" data-n="${k}"></span></button>`).join('')}
    </nav>
    <div class="antrean-list" id="list"><p class="empty">Memuat…</p></div>`;

  const listEl = app.querySelector('#list');

  const cocok = (t) => filter === 'semua'
    || (filter === 'meja' && t.nama_meja)
    || (filter === 'kasir' && !t.nama_meja)
    || (filter === 'bayar' && t.status_bayar === 'belum_bayar');

  function gambar() {
    const n = daftar.length;
    const jml = app.querySelector('#jumlah');
    jml.hidden = n === 0;
    jml.textContent = String(n);
    const hitung = { semua: n, meja: 0, kasir: 0, bayar: 0 };
    daftar.forEach((t) => { hitung[t.nama_meja ? 'meja' : 'kasir']++; if (t.status_bayar === 'belum_bayar') hitung.bayar++; });
    app.querySelectorAll('[data-n]').forEach((el) => { const v = hitung[el.dataset.n]; el.textContent = v ? ` ${v}` : ''; });

    const tampil = daftar.filter(cocok);
    if (!tampil.length) {
      listEl.innerHTML = `<div class="bantuan-card trx-kosong">${ikonAntrean}<p>${n ? 'Tidak ada pesanan di kategori ini.' : 'Tidak ada pesanan yang menunggu. Pesanan baru dari meja atau kasir akan muncul di sini.'}</p></div>`;
      return;
    }
    listEl.innerHTML = tampil.map((t) => {
      const urutan = daftar.indexOf(t) + 1;
      const belumBayar = t.status_bayar === 'belum_bayar';
      const lama = menitSejak(t.waktu_transaksi);
      return `
        <article class="bantuan-card antrean-item ${lama >= 15 ? 'lama' : ''}" data-id="${t.id_transaksi}">
          <div class="antrean-atas">
            <span class="antrean-no num" title="Urutan antrean">${urutan}</span>
            <div class="grow">
              <div class="menu-item-baris"><b class="num">${esc(kodePesanan(t.waktu_transaksi, t.nomor_harian))}</b><b class="num">${rupiah(t.total)}</b></div>
              <span class="trx-nama">${esc(t.nama_pelanggan || 'Pelanggan umum')}</span>
              <span class="trx-chips">
                ${t.nama_meja ? `<span class="chip-meja">${esc(t.nama_meja)}</span>` : '<span class="chip-kasir">Kasir</span>'}
                <span class="chip-metode">${t.metode_bayar === 'qris' ? 'QRIS' : 'Tunai'}</span>
                ${belumBayar ? '<span class="trx-status belum_bayar">Belum Dibayar</span>' : '<span class="trx-status disiapkan">Lunas</span>'}
              </span>
            </div>
          </div>
          <ul class="antrean-menu">${t.items.map((i) => `<li><b class="num">${angka(i.jumlah)}×</b> ${esc(i.nama_barang)}</li>`).join('')}</ul>
          ${t.catatan ? `<p class="antrean-catatan">Catatan: ${esc(t.catatan)}</p>` : ''}
          <span class="antrean-waktu num">Masuk ${t.waktu_transaksi.slice(11, 16).replace(':', '.')} · ${lamaTunggu(t.waktu_transaksi)}</span>
          <div class="trx-aksi tiga">
            <a class="btn-kecil blok" href="#/transaksi/detail?id=${t.id_transaksi}">Detail</a>
            <button type="button" class="btn-kecil blok garis" data-aksi="batal">Batalkan</button>
            ${belumBayar
              ? '<button type="button" class="btn-kecil blok garis" disabled title="Tunggu pembeli membayar QRIS">Menunggu Bayar</button>'
              : '<button type="button" class="btn-kecil blok utama" data-aksi="selesai">Selesai</button>'}
          </div>
        </article>`;
    }).join('');
  }

  async function muat() {
    try {
      daftar = await api('/transaksi/antrean');
    } catch (err) {
      listEl.innerHTML = `<div class="notice err">${esc(err.message)}</div>`;
      return;
    }
    // Beri tahu bila ada pesanan baru sejak pemuatan sebelumnya.
    const ids = new Set(daftar.map((t) => t.id_transaksi));
    if (idSebelumnya) {
      const baru = daftar.filter((t) => !idSebelumnya.has(t.id_transaksi));
      if (baru.length) toast(baru.length === 1 ? `Pesanan baru masuk${baru[0].nama_meja ? ` dari ${baru[0].nama_meja}` : ''}` : `${baru.length} pesanan baru masuk`, 'ok');
    }
    idSebelumnya = ids;
    // Gambar ulang hanya bila ada perubahan (atau tiap menit untuk "x menit lalu"),
    // supaya tombol tidak diganti tepat saat sedang diketuk di HP.
    const tanda = JSON.stringify([sekarangWIB().jam, daftar.map((t) => [t.id_transaksi, t.status, t.status_bayar])]);
    if (tanda === tandaTerakhir) return;
    tandaTerakhir = tanda;
    gambar();
  }

  app.querySelector('#filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    filter = b.dataset.f;
    app.querySelectorAll('#filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    gambar();
  });

  listEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-aksi]');
    if (!b || b.disabled) return;
    const t = daftar.find((x) => x.id_transaksi === Number(b.closest('[data-id]').dataset.id));
    b.disabled = true;
    try {
      if (b.dataset.aksi === 'selesai') await tandaiSelesai(t);
      else if (!(await batalkan(t))) { b.disabled = false; return; }
    } catch (err) {
      toast(err.message, 'err');
    }
    idSebelumnya = null; // perubahan dari halaman ini sendiri bukan "pesanan baru"
    await muat();
  });

  await muat();
  const segarkan = setInterval(() => {
    if (!document.querySelector('.sheet-backdrop')) muat();
  }, 5000);
  return () => clearInterval(segarkan);
}
