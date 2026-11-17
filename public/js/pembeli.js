// Halaman pembeli (tanpa login).
//  - Tamu (/): lihat jadwal buka & sisa stok menu. Tidak bisa memesan.
//  - Pembeli di meja (/m/<kode> dari scan QR): bisa memesan, lalu bayar QRIS (simulasi).
//  - /bayar/<kode>: halaman simulasi pembayaran (dibuka dari scan QR bayar).
import { api, esc, rupiah, angka, toast, ikonCari, kapital, sekarangWIB, infoTanggal } from './util.js';
import { ikon } from './pages/auth.js';

const app = document.getElementById('app');
const KUNCI_PESANAN = 'pembeli.pesanan';
const ikonCentang = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const ikonX = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';

// Tautan lama ke halaman admin (/#/kasir, ...) diarahkan ke /admin.
if (/^#\/(beranda|kasir|stok|jadwal|transaksi|lainnya|bantuan)/.test(location.hash)) {
  location.replace('/admin' + location.hash);
}

// ---------------------------------------------------------------------
// Penyimpanan kecil di HP ini: daftar pesanan yang pernah dibuat
// ---------------------------------------------------------------------
function bacaPesanan() {
  try { return JSON.parse(localStorage.getItem(KUNCI_PESANAN) || '[]'); } catch { return []; }
}
function simpanPesanan(p) {
  const arr = bacaPesanan().filter((x) => x.kode_bayar !== p.kode_bayar);
  arr.unshift(p);
  try { localStorage.setItem(KUNCI_PESANAN, JSON.stringify(arr.slice(0, 20))); } catch { /* abaikan */ }
}

const LABEL_STATUS = {
  belum_bayar: ['Menunggu Pembayaran', 'belum_selesai'],
  disiapkan: ['Sedang Disiapkan', 'disiapkan'],
  selesai: ['Selesai', 'selesai'],
  dibatalkan: ['Dibatalkan', 'dibatalkan'],
};
function statusPembeli(p) {
  if (p.status === 'dibatalkan') return 'dibatalkan';
  if (p.status === 'selesai') return 'selesai';
  return p.status_bayar === 'lunas' ? 'disiapkan' : 'belum_bayar';
}
const badge = (p) => { const [l, k] = LABEL_STATUS[statusPembeli(p)]; return `<span class="trx-status ${k}">${l}</span>`; };

function setIdentitas(teks, meja) {
  const el = document.getElementById('identitas');
  el.hidden = false;
  el.className = `identitas ${meja ? 'meja' : ''}`;
  el.textContent = teks;
}

// ---------------------------------------------------------------------
// Router: pathname menentukan peran, hash menentukan tampilan
// ---------------------------------------------------------------------
const [, jenis, kodePath] = location.pathname.split('/');

if (jenis === 'bayar' && kodePath) {
  halamanBayar(kodePath);
} else if (jenis === 'm' && kodePath) {
  mulaiMeja(kodePath);
} else {
  setIdentitas('Tamu', false);
  aplikasi({ meja: null });
}

async function mulaiMeja(kode) {
  try {
    const { nama_meja } = await api(`/publik/meja/${encodeURIComponent(kode)}`);
    setIdentitas(nama_meja, true);
    document.getElementById('brand').href = `/m/${kode}`;
    aplikasi({ meja: { kode, nama: nama_meja } });
  } catch (err) {
    setIdentitas('Tamu', false);
    app.innerHTML = `
      <div class="notice err">${esc(err.message)}</div>
      <p class="small muted" style="margin:0 2px 14px">Kamu tetap bisa melihat jadwal dan sisa stok sebagai tamu.</p>`;
    const wadah = document.createElement('div');
    app.appendChild(wadah);
    aplikasi({ meja: null, wadah });
  }
}

// ---------------------------------------------------------------------
// Aplikasi utama (tamu / pembeli di meja)
// ---------------------------------------------------------------------
function aplikasi({ meja, wadah = app }) {
  /** keranjang: Map<id_barang, jumlah> */
  const keranjang = new Map();
  let barang = [];
  let status = null;
  let jadwalMinggu = [];
  let kata = '';
  let pantau = null;

  window.addEventListener('hashchange', tampil);
  tampil();

  function tampil() {
    if (pantau) { clearInterval(pantau); pantau = null; }
    window.scrollTo(0, 0);
    const h = location.hash.replace(/^#\/?/, '');
    if (meja && h === 'pesan') return halamanCheckout();
    if (meja && h.startsWith('pesanan/')) return halamanPesanan(h.slice(8));
    return halamanUtama();
  }

  async function muatData() {
    [barang, status, jadwalMinggu] = await Promise.all([
      api('/barang'),
      api('/publik/status'),
      api(`/jadwal?dari=${sekarangWIB().tanggal}&hari=7`),
    ]);
    barang.sort((a, b) => a.id_barang - b.id_barang);
  }

  const byId = (id) => barang.find((b) => b.id_barang === id);
  const total = () => [...keranjang].reduce((s, [id, n]) => s + (byId(id)?.harga_jual || 0) * n, 0);
  const jumlahItem = () => [...keranjang.values()].reduce((s, n) => s + n, 0);

  // ---------------- Halaman utama ----------------
  async function halamanUtama() {
    wadah.innerHTML = '<p class="empty">Memuat menu…</p>';
    try { await muatData(); } catch (err) { wadah.innerHTML = `<div class="notice err">${esc(err.message)}</div>`; return; }

    const pesananSaya = meja ? bacaPesanan().filter((p) => p.meja_kode === meja.kode && p.tanggal === sekarangWIB().tanggal) : [];
    wadah.innerHTML = `
      <section class="bantuan-card pb-hero">
        <h1>Selamat datang!</h1>
        ${meja
          ? `<p>Kamu memesan dari <b>${esc(meja.nama)}</b>. Pilih menu, lalu bayar dengan QRIS.</p>
             ${status.buka ? '' : `<div class="pb-info tutup">${ikon.tanya}<span><b>Pemesanan sedang ditutup.</b> ${esc(status.pesan)} Kamu tetap bisa melihat menu dan sisa stok.</span></div>`}`
          : `<p>Lihat jadwal buka dan sisa stok menu hari ini.</p>
             <div class="pb-info">${ikon.tanya}<span>Kamu masuk sebagai <b>tamu</b>. Untuk memesan, scan QR yang ada di meja.</span></div>`}
      </section>

      <section class="bantuan-card pb-status">
        <div class="menu-item-baris">
          <div>
            <span class="label-kecil">SEKARANG</span>
            <b>${status.buka ? 'Warung buka' : 'Warung tutup'}</b>
            <span class="small muted">${esc(status.pesan)}</span>
          </div>
          <span class="status-pill ${status.buka ? 'buka' : 'tutup'}"><i></i>${status.buka ? 'Buka' : 'Tutup'}</span>
        </div>
        <details class="pb-jadwal">
          <summary>Lihat jadwal 7 hari</summary>
          <ul>${jadwalMinggu.map(({ tanggal, jadwal: j }) => {
            const i = infoTanggal(tanggal);
            return `<li class="${tanggal === sekarangWIB().tanggal ? 'hari-ini' : ''}"><span>${i.hariPanjang}, ${i.tgl} ${i.bulan}</span><b class="num">${!j ? 'Belum diatur' : j.buka ? `${j.jam_buka} - ${j.jam_tutup}` : 'Tutup'}</b></li>`;
          }).join('')}</ul>
        </details>
      </section>

      ${pesananSaya.length ? `
        <section class="bantuan-card trx-kartu">
          <div class="trx-kartu-head"><h2>Pesanan Saya</h2><span class="small muted">hari ini</span></div>
          <div class="pb-pesanan-list" id="pesanan-saya">${pesananSaya.map((p) => `
            <a class="pb-pesanan" href="#pesanan/${esc(p.kode_bayar)}" data-kode="${esc(p.kode_bayar)}">
              <span><b class="num">${esc(p.kode_pesanan)}</b><span class="small muted num">${rupiah(p.total)}</span></span>
              <span class="pb-pesanan-status">Memuat…</span>
            </a>`).join('')}</div>
        </section>` : ''}

      <h2 class="trx-h2">Menu Hari Ini</h2>
      <div class="bantuan-card bantuan-cari">
        <label class="bantuan-cari-input">${ikonCari}<input type="search" id="cari" placeholder="Cari nama menu…" aria-label="Cari nama menu" autocomplete="off" value="${esc(kata)}"></label>
      </div>
      ${meja && !status.buka ? `<div class="notice warn pb-tutup-menu">Pemesanan ditutup: ${esc(status.pesan)}</div>` : ''}
      <div class="menu-list" id="menu"></div>
      ${meja ? '<div class="cartbar hidden" id="cartbar"><a class="btn primary" href="#pesan"><span id="cart-info"></span><span>Lanjut Pesan ›</span></a></div>' : ''}`;

    gambarMenu();
    gambarCartbar();
    wadah.querySelector('#cari').addEventListener('input', (e) => { kata = e.target.value.trim(); gambarMenu(); });
    wadah.querySelector('#menu').addEventListener('click', (e) => {
      const t = e.target.closest('[data-tambah]');
      if (t && !t.disabled) ubahJumlah(Number(t.dataset.tambah), 1);
    });

    // Status terbaru untuk "Pesanan Saya"
    wadah.querySelectorAll('#pesanan-saya [data-kode]').forEach(async (a) => {
      try {
        const p = await api(`/publik/pesanan/${a.dataset.kode}`);
        a.querySelector('.pb-pesanan-status').innerHTML = badge(p);
      } catch { a.querySelector('.pb-pesanan-status').textContent = '-'; }
    });
  }

  function gambarMenu() {
    const el = wadah.querySelector('#menu');
    if (!el) return;
    const k = kata.toLowerCase();
    const rows = barang.filter((b) => b.nama_barang.toLowerCase().includes(k));
    if (!rows.length) { el.innerHTML = `<p class="empty">${kata ? `Tidak ada menu “${esc(kata)}”.` : 'Belum ada menu.'}</p>`; return; }
    el.innerHTML = rows.map((b) => {
      const n = keranjang.get(b.id_barang) || 0;
      const habis = b.stok_saat_ini <= 0;
      const label = habis ? '<b class="habis-teks">Habis</b>' : b.status === 'menipis' ? `Sisa <b>${angka(b.stok_saat_ini)}</b> · <span class="pb-menipis">hampir habis</span>` : `Sisa <b>${angka(b.stok_saat_ini)}</b>`;
      return `
        <article class="menu-item ${n ? 'in-cart' : ''} ${habis ? 'habis' : ''}">
          <div class="menu-item-baris"><h3>${esc(b.nama_barang)}</h3><b class="num">${rupiah(b.harga_jual)}</b></div>
          <p class="menu-item-satuan">Satuan: ${esc(kapital(b.satuan))}</p>
          <div class="menu-item-baris bawah">
            <span class="menu-item-stok num">${label}${n ? ` · <span class="di-pesanan">${n} dipesan</span>` : ''}</span>
            ${meja ? `<button type="button" class="btn-tambah" data-tambah="${b.id_barang}" ${habis || !status.buka ? 'disabled' : ''} aria-label="${habis ? `${esc(b.nama_barang)} habis` : !status.buka ? 'Pemesanan ditutup' : `Tambah ${esc(b.nama_barang)}`}">${habis ? 'Habis' : !status.buka ? 'Tutup' : '+ Tambah'}</button>` : ''}
          </div>
        </article>`;
    }).join('');
  }

  function gambarCartbar() {
    const bar = wadah.querySelector('#cartbar');
    if (!bar) return;
    bar.classList.toggle('hidden', keranjang.size === 0);
    wadah.querySelector('#cart-info').textContent = `${jumlahItem()} item · ${rupiah(total())}`;
  }

  function ubahJumlah(id, delta) {
    const b = byId(id);
    if (!b) return;
    const baru = (keranjang.get(id) || 0) + delta;
    if (delta > 0 && baru > b.stok_saat_ini) { toast(`Stok ${b.nama_barang} tinggal ${b.stok_saat_ini} ${b.satuan}.`, 'err'); return; }
    if (baru <= 0) keranjang.delete(id); else keranjang.set(id, baru);
    gambarMenu();
    gambarCartbar();
  }

  // ---------------- Checkout ----------------
  async function halamanCheckout() {
    if (!barang.length) { try { await muatData(); } catch { /* ditangani di bawah */ } }
    if (!keranjang.size) { location.hash = ''; return; }
    const tutup = !status?.buka;
    wadah.innerHTML = `
      <a href="#" class="btn-kembali">${ikon.kiri} Kembali ke Menu</a>
      <section class="bantuan-card pesanan">
        <div class="pesanan-head"><div><h2>Pesanan Kamu</h2><span class="pesanan-kode">${esc(meja.nama)}</span></div></div>
        <div id="lines"></div>
        <div class="pesanan-blok">
          <label for="nama">Nama Pemesan <span class="wajib">*</span></label>
          <input class="input" id="nama" maxlength="60" autocomplete="given-name" placeholder="Supaya pesananmu mudah dipanggil">
          <div class="err" id="err-nama"></div>
        </div>
        <div class="pesanan-blok">
          <label for="catatan">Catatan (Opsional)</label>
          <input class="input" id="catatan" maxlength="200" autocomplete="off" placeholder="Contoh: Tidak pedas">
        </div>
        <div class="pesanan-blok ringkasan num" id="ringkasan"></div>
        <div class="pb-metode">${ikonQris()}<div><b>Bayar dengan QRIS</b><span class="small muted">QR pembayaran muncul setelah pesanan dibuat.</span></div></div>
        ${tutup ? `<div class="notice warn">${esc(status?.pesan || 'Warung sedang tutup.')}</div>` : ''}
        <div id="err-pesan"></div>
        <button type="button" class="btn primary block lg" id="btn-pesan" ${tutup ? 'disabled' : ''}>Pesan &amp; Bayar QRIS</button>
      </section>`;

    const gambar = () => {
      wadah.querySelector('#lines').innerHTML = [...keranjang].map(([id, n]) => {
        const b = byId(id);
        return `
          <div class="pesanan-blok pesanan-item" data-id="${id}">
            <div class="menu-item-baris"><b>${esc(b.nama_barang)}</b><b class="num">${rupiah(b.harga_jual * n)}</b></div>
            <div class="menu-item-baris">
              <span class="small muted num">Jumlah: ${n}${n > 1 ? ` × ${rupiah(b.harga_jual)}` : ''}</span>
              <div class="stepper-mini">
                <button type="button" data-act="kurang" aria-label="Kurangi ${esc(b.nama_barang)}">−</button>
                <button type="button" data-act="tambah" class="plus" aria-label="Tambah ${esc(b.nama_barang)}">+</button>
              </div>
            </div>
          </div>`;
      }).join('');
      wadah.querySelector('#ringkasan').innerHTML = `<div class="total"><span>Total Pembayaran</span><span>${rupiah(total())}</span></div>`;
    };
    gambar();

    wadah.querySelector('#lines').addEventListener('click', (e) => {
      const act = e.target.closest('[data-act]');
      const line = e.target.closest('.pesanan-item');
      if (!act || !line) return;
      ubahJumlah(Number(line.dataset.id), act.dataset.act === 'tambah' ? 1 : -1);
      if (!keranjang.size) { location.hash = ''; return; }
      gambar();
    });
    wadah.querySelector('#nama').addEventListener('input', () => { wadah.querySelector('#err-nama').textContent = ''; });

    wadah.querySelector('#btn-pesan').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const nama = wadah.querySelector('#nama').value.trim();
      const errBox = wadah.querySelector('#err-pesan');
      errBox.innerHTML = '';
      if (!nama) { wadah.querySelector('#err-nama').textContent = 'Nama pemesan wajib diisi.'; wadah.querySelector('#nama').focus(); return; }
      btn.disabled = true;
      btn.textContent = 'Mengirim pesanan…';
      try {
        const p = await api(`/publik/meja/${encodeURIComponent(meja.kode)}/pesanan`, {
          method: 'POST',
          body: { nama_pelanggan: nama, catatan: wadah.querySelector('#catatan').value, items: [...keranjang].map(([id_barang, jumlah]) => ({ id_barang, jumlah })) },
        });
        simpanPesanan({ kode_bayar: p.kode_bayar, kode_pesanan: p.kode_pesanan, total: p.total, meja_kode: meja.kode, tanggal: p.waktu_transaksi.slice(0, 10) });
        keranjang.clear();
        location.hash = `pesanan/${p.kode_bayar}`;
      } catch (err) {
        errBox.innerHTML = `<div class="notice err">${esc(err.message)}</div>`;
        btn.disabled = false;
        btn.textContent = 'Pesan & Bayar QRIS';
        await muatData().catch(() => {});
      }
    });
  }

  // ---------------- Status pesanan + QR bayar ----------------
  async function halamanPesanan(kodeBayar) {
    wadah.innerHTML = '<p class="empty">Memuat pesanan…</p>';
    let terakhir = '';
    async function muat() {
      let p;
      try { p = await api(`/publik/pesanan/${encodeURIComponent(kodeBayar)}`); } catch (err) {
        wadah.innerHTML = `<a href="#" class="btn-kembali">${ikon.kiri} Kembali ke Menu</a><div class="notice err">${esc(err.message)}</div>`;
        return false;
      }
      const s = statusPembeli(p);
      const kunci = `${p.status}|${p.status_bayar}`;
      if (kunci === terakhir) return s === 'belum_bayar' || s === 'disiapkan';
      if (terakhir && s === 'disiapkan') toast('Pembayaran diterima. Pesananmu sedang disiapkan.', 'ok');
      terakhir = kunci;
      const linkBayar = `/bayar/${encodeURIComponent(p.kode_bayar)}`;
      wadah.innerHTML = `
        <a href="#" class="btn-kembali">${ikon.kiri} Kembali ke Menu</a>
        <section class="bantuan-card trx-kartu">
          <div class="menu-item-baris"><div><h1 class="trx-judul num">${esc(p.kode_pesanan)}</h1><p class="trx-sub rapat">${esc(p.nama_meja || '')} · atas nama ${esc(p.nama_pelanggan || '-')}</p></div>${badge(p)}</div>
        </section>
        ${s === 'belum_bayar' ? `
          <section class="bantuan-card trx-kartu pb-bayar">
            <h2>Bayar dengan QRIS</h2>
            <p class="trx-sub">Scan QR ini untuk membayar. Halaman ini otomatis diperbarui setelah pembayaran diterima.</p>
            <img class="pb-qr" src="/qr/bayar/${encodeURIComponent(p.kode_bayar)}.svg" alt="QR pembayaran pesanan ${esc(p.kode_pesanan)}" width="220" height="220">
            <span class="trx-label">Total Pembayaran</span>
            <b class="trx-besar num">${rupiah(p.total)}</b>
            <div class="pb-info">${ikon.tanya}<span><b>Mode simulasi</b> (belum ada payment gateway). Scan QR dengan HP lain untuk membuka halaman bayar, lalu tekan "Tandai sudah dibayar".</span></div>
            <a class="pb-link-demo" href="${linkBayar}" target="_blank" rel="noopener">Buka halaman bayar (simulasi) ›</a>
          </section>` : ''}
        ${s === 'disiapkan' ? `<div class="pb-hasil ok">${ikonCentang}<div><b>Pembayaran diterima</b><span>Pesananmu sedang disiapkan. Mohon tunggu di ${esc(p.nama_meja || 'meja')}.</span></div></div>` : ''}
        ${s === 'selesai' ? `<div class="pb-hasil ok">${ikonCentang}<div><b>Pesanan selesai</b><span>Selamat menikmati!</span></div></div>` : ''}
        ${s === 'dibatalkan' ? `<div class="pb-hasil batal">${ikonX}<div><b>Pesanan dibatalkan</b><span>Pesanan ini dibatalkan oleh warung. Silakan hubungi kasir bila ada pertanyaan.</span></div></div>` : ''}
        <section class="bantuan-card trx-kartu">
          <h2>Rincian Pesanan</h2>
          ${p.items.map((i) => `
            <div class="trx-rincian num">
              <div class="menu-item-baris"><b>${esc(i.nama_barang)}</b><b>${rupiah(i.subtotal)}</b></div>
              <div class="menu-item-baris"><span>Jumlah: <b>${angka(i.jumlah)}</b> × ${rupiah(i.harga_satuan)}</span></div>
            </div>`).join('')}
          <div class="trx-baris"><span>Total</span><b class="num">${rupiah(p.total)}</b></div>
          ${p.catatan ? `<div class="trx-catatan-kotak">Catatan: ${esc(p.catatan)}</div>` : ''}
        </section>
        <a href="#" class="btn block btn-batal">Pesan Menu Lain</a>`;
      return s === 'belum_bayar' || s === 'disiapkan';
    }
    const lanjut = await muat();
    // Pantau perubahan status (pembayaran / selesai) tiap 3 detik selama halaman terbuka.
    if (lanjut) pantau = setInterval(async () => { if (!(await muat())) { clearInterval(pantau); pantau = null; } }, 3000);
  }
}

function ikonQris() {
  return '<span class="pb-qris" aria-hidden="true">QRIS</span>';
}

// ---------------------------------------------------------------------
// Halaman simulasi pembayaran QRIS (/bayar/<kode>)
// ---------------------------------------------------------------------
async function halamanBayar(kode) {
  setIdentitas('Simulasi QRIS', false);
  document.getElementById('brand').removeAttribute('href');
  async function gambar(selesaiBaru = false) {
    let p;
    try { p = await api(`/publik/pesanan/${encodeURIComponent(kode)}`); } catch (err) {
      app.innerHTML = `<div class="notice err">${esc(err.message)}</div>`;
      return;
    }
    const lunas = p.status_bayar === 'lunas';
    const batal = p.status === 'dibatalkan';
    app.innerHTML = `
      <section class="bantuan-card pb-bayar-sim">
        <div class="pb-bayar-head">${ikonQris()}<div><b>Dapoer Bu Mimin</b><span class="small muted">Pembayaran pesanan ${esc(p.kode_pesanan)}</span></div></div>
        <span class="trx-label">Total Tagihan</span>
        <b class="trx-besar num">${rupiah(p.total)}</b>
        <div class="trx-baris"><span>Meja</span><b>${esc(p.nama_meja || '-')}</b></div>
        <div class="trx-baris"><span>Atas nama</span><b>${esc(p.nama_pelanggan || '-')}</b></div>
        <div class="trx-baris"><span>Item</span><b>${p.items.map((i) => `${esc(i.nama_barang)} ×${i.jumlah}`).join(', ')}</b></div>
        ${batal
          ? `<div class="pb-hasil batal">${ikonX}<div><b>Pesanan dibatalkan</b><span>Pesanan ini sudah dibatalkan, tidak perlu dibayar.</span></div></div>`
          : lunas
            ? `<div class="pb-hasil ok">${ikonCentang}<div><b>${selesaiBaru ? 'Pembayaran berhasil' : 'Sudah dibayar'}</b><span>Pembayaran untuk pesanan ini sudah diterima.</span></div></div>`
            : `<button type="button" class="btn primary block lg" id="tandai">Tandai sudah dibayar</button>`}
        <p class="pb-catatan-sim">Ini simulasi pembayaran QRIS untuk prototype. Tidak ada uang yang ditransfer.</p>
      </section>`;
    app.querySelector('#tandai')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      e.currentTarget.textContent = 'Memproses…';
      try {
        await api(`/publik/bayar/${encodeURIComponent(kode)}`, { method: 'POST', body: {} });
        await gambar(true);
      } catch (err) {
        toast(err.message, 'err');
        await gambar();
      }
    });
  }
  await gambar();
}
