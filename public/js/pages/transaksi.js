// Transaksi: ringkasan hari ini, daftar pesanan (selesai / batalkan), detail,
// menu terlaris, dan rekap pemasukan per tanggal.
import { api, esc, rupiah, angka, toast, ikonMenu, kodePesanan, sekarangWIB, bukaSheet } from '../util.js';
import { ikon } from './auth.js';
import { tombolTanggal, pilihTanggal, tanggalBulanPanjang, BULAN_PANJANG } from '../kalender.js';

const ikonKosong = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>';
const LABEL_STATUS = { belum_selesai: 'Belum Selesai', selesai: 'Selesai', dibatalkan: 'Dibatalkan' };

const kode = (t) => kodePesanan(t.waktu_transaksi, t.nomor_harian);
const jam = (t) => t.waktu_transaksi.slice(11, 16).replace(':', '.');
const namaPelanggan = (t) => t.nama_pelanggan || 'Pelanggan umum';
const badgeStatus = (s) => `<span class="trx-status ${s}">${LABEL_STATUS[s] || s}</span>`;
const metodeLabel = (m) => (m === 'qris' ? 'QRIS' : 'Tunai');
const belumBayar = (t) => t.status_bayar === 'belum_bayar' && t.status !== 'dibatalkan';
/** Chip sumber pesanan (meja) + status bayar untuk pesanan dari pembeli. */
const chipSumber = (t) => (t.nama_meja ? `<span class="chip-meja">${esc(t.nama_meja)}</span>` : '')
  + (belumBayar(t) ? '<span class="trx-status belum_bayar">Belum Dibayar</span>' : '');

export async function render(app, sub, q) {
  if (sub === 'detail') return detail(app, q);
  if (sub === 'terlaris') return terlaris(app, q);
  if (sub === 'rekap') return rekap(app, q);
  return utama(app);
}

/** Ganti query di alamat tanpa memuat ulang halaman (supaya tombol kembali tetap ingat tanggal). */
function setQuery(path, q) {
  history.replaceState(null, '', `#/${path}?${new URLSearchParams(q)}`);
}

// ---------------------------------------------------------------------
// Aksi status: Selesai / Batalkan (dipakai di daftar dan detail)
// ---------------------------------------------------------------------
export async function tandaiSelesai(t) {
  await api(`/transaksi/${t.id_transaksi}/status`, { method: 'PATCH', body: { status: 'selesai' } });
  toast(`Pesanan ${kode(t)} selesai`, 'ok');
}

function konfirmasiBatal(t) {
  return new Promise((selesai) => {
    let hasil = false;
    const { el, tutup } = bukaSheet(`
      <h2>Batalkan pesanan ${esc(kode(t))}?</h2>
      <p class="small muted" style="margin:0 0 12px;line-height:1.5">
        Pesanan atas nama <b>${esc(namaPelanggan(t))}</b> (${rupiah(t.total)}) akan dibatalkan dan tidak dihitung sebagai pemasukan.
        Stok ${t.items.map((i) => `${esc(i.nama_barang)} ×${i.jumlah}`).join(', ')} dikembalikan. Pembatalan tidak bisa diurungkan.
      </p>
      <div class="row">
        <button type="button" class="btn grow" data-aksi="tidak">Jangan batalkan</button>
        <button type="button" class="btn grow btn-bahaya" data-aksi="ya">Ya, batalkan</button>
      </div>`, { onClose: () => selesai(hasil) });
    el.querySelector('[data-aksi="tidak"]').addEventListener('click', tutup);
    el.querySelector('[data-aksi="ya"]').addEventListener('click', () => { hasil = true; tutup(); });
  });
}

export async function batalkan(t) {
  if (!(await konfirmasiBatal(t))) return false;
  await api(`/transaksi/${t.id_transaksi}/status`, { method: 'PATCH', body: { status: 'dibatalkan' } });
  toast(`Pesanan ${kode(t)} dibatalkan, stok dikembalikan`, 'ok');
  return true;
}

// ---------------------------------------------------------------------
// Halaman utama Transaksi (hari ini)
// ---------------------------------------------------------------------
async function utama(app) {
  const hariIni = sekarangWIB().tanggal;
  app.innerHTML = `
    <section class="bantuan-card kasir-hero">
      <span class="bantuan-hero-ikon">${ikonMenu.transaksi}</span>
      <h1>Transaksi</h1>
    </section>
    <section class="bantuan-card trx-kartu" id="pemasukan"><p class="empty">Memuat…</p></section>
    <section class="bantuan-card trx-kartu" id="terlaris"></section>
    <section class="bantuan-card trx-kartu" id="daftar"></section>`;

  let tandaTerakhir = '';
  async function muat() {
    const [log, laris] = await Promise.all([
      api(`/transaksi?tanggal=${hariIni}`),
      api(`/transaksi/terlaris?tanggal=${hariIni}`),
    ]);
    // Gambar ulang hanya bila datanya berubah, supaya tombol tidak diganti saat sedang diketuk.
    const tanda = JSON.stringify([log.transaksi.map((t) => [t.id_transaksi, t.status, t.status_bayar]), laris.menu.map((m) => [m.id_barang, m.jumlah])]);
    if (tanda === tandaTerakhir) return;
    tandaTerakhir = tanda;
    const s = log.ringkasan;

    app.querySelector('#pemasukan').innerHTML = `
      <div class="trx-kartu-head"><h2>Pemasukan Hari Ini</h2><a class="btn-kecil" href="#/transaksi/rekap?tanggal=${hariIni}">Lihat Rekap</a></div>
      <b class="trx-besar num">${rupiah(s.total)}</b>
      <div class="trx-dua num">
        <div><span>Tunai</span><b>${rupiah(s.total_tunai)}</b></div>
        <div><span>QRIS</span><b>${rupiah(s.total_qris)}</b></div>
      </div>
      ${s.belum_bayar ? `<p class="trx-tunggu num">Menunggu pembayaran QRIS: ${angka(s.belum_bayar)} pesanan (${rupiah(s.total_belum_bayar)}), belum dihitung.</p>` : ''}`;

    const top = laris.menu.slice(0, 3);
    app.querySelector('#terlaris').innerHTML = `
      <div class="trx-kartu-head"><h2>Menu Terlaris Hari Ini</h2><a class="btn-kecil" href="#/transaksi/terlaris?tanggal=${hariIni}">Lihat Daftar</a></div>
      ${top.length
        ? `<ol class="trx-rank">${top.map((m, i) => `
            <li><span class="rank-no">${i + 1}</span><b>${esc(m.nama_barang)}</b><span class="muted num">${angka(m.jumlah)} ${esc(m.satuan)} terjual</span></li>`).join('')}</ol>`
        : '<p class="trx-kosong-kecil">Belum ada menu terjual dari pesanan yang selesai hari ini.</p>'}`;

    app.querySelector('#daftar').innerHTML = `
      <h2>Daftar Transaksi</h2>
      <p class="trx-sub">Tinjau pesanan yang masuk, konfirmasi selesai, atau batalkan transaksi yang belum selesai.</p>
      <div class="trx-dua kotak num">
        <div><span>Total Pesanan</span><b>${angka(s.jumlah_transaksi)}</b></div>
        <div><span>Belum Selesai</span><b>${angka(s.belum_selesai)}</b></div>
      </div>
      ${log.transaksi.length
        ? `<div class="trx-list">${log.transaksi.map((t) => `
            <article class="trx-item ${t.status}" data-id="${t.id_transaksi}">
              <div class="menu-item-baris">
                <div><b class="num">${esc(kode(t))}</b><span class="trx-nama">${esc(namaPelanggan(t))}</span>${chipSumber(t) ? `<span class="trx-chips">${chipSumber(t)}</span>` : ''}</div>
                ${badgeStatus(t.status)}
              </div>
              <div class="trx-aksi ${t.status === 'belum_selesai' ? 'tiga' : ''}">
                <a class="btn-kecil blok" href="#/transaksi/detail?id=${t.id_transaksi}">Detail Transaksi</a>
                ${t.status === 'belum_selesai' ? `
                  <button type="button" class="btn-kecil blok garis" data-aksi="batal">Batalkan</button>
                  ${belumBayar(t)
                    ? '<button type="button" class="btn-kecil blok garis" disabled title="Tunggu pembeli membayar QRIS">Menunggu Bayar</button>'
                    : '<button type="button" class="btn-kecil blok utama" data-aksi="selesai">Selesai</button>'}` : ''}
              </div>
            </article>`).join('')}</div>`
        : '<p class="trx-kosong-kecil">Belum ada transaksi hari ini.</p>'}`;

    app.querySelector('#daftar').onclick = async (e) => {
      const b = e.target.closest('[data-aksi]');
      if (!b) return;
      const t = log.transaksi.find((x) => x.id_transaksi === Number(b.closest('[data-id]').dataset.id));
      b.disabled = true;
      try {
        if (b.dataset.aksi === 'selesai') await tandaiSelesai(t);
        else if (!(await batalkan(t))) { b.disabled = false; return; }
        await muat();
      } catch (err) {
        toast(err.message, 'err');
        await muat();
      }
    };
  }
  await muat();
  const segarkan = setInterval(() => {
    if (!document.querySelector('.sheet-backdrop')) muat().catch(() => {});
  }, 10000);
  return () => clearInterval(segarkan);
}

// ---------------------------------------------------------------------
// Detail transaksi
// ---------------------------------------------------------------------
async function detail(app, q) {
  const kembali = q.dari === 'rekap' && q.tanggal ? `#/transaksi/rekap?tanggal=${q.tanggal}` : '#/transaksi';
  async function muat() {
    const t = await api(`/transaksi/${Number(q.id)}`);
    const tunai = t.metode_bayar === 'tunai';
    const uang = tunai ? t.uang_diterima : t.total;
    const baris = (l, v) => `<div class="trx-baris"><span>${l}</span><b class="num">${v}</b></div>`;
    app.innerHTML = `
      <a href="${kembali}" class="btn-kembali">${ikon.kiri} Kembali ke ${q.dari === 'rekap' ? 'Rekap' : 'Transaksi'}</a>
      <section class="bantuan-card trx-kartu">
        <h1 class="trx-judul">Detail Transaksi</h1>
        <p class="trx-sub rapat num">${tanggalBulanPanjang(t.waktu_transaksi.slice(0, 10))} · ${jam(t)}<br>${t.nama_meja ? `Dipesan pembeli dari ${esc(t.nama_meja)} (lewat QR)` : `Dicatat oleh ${esc(t.pencatat)}`}</p>
        <div class="trx-garis"></div>
        ${baris('Nomor Pesanan', esc(kode(t)))}
        ${baris('Nama Pelanggan', esc(t.nama_pelanggan || '-'))}
        ${baris('Metode Pembayaran', metodeLabel(t.metode_bayar))}
        <div class="trx-baris"><span>Status</span>${badgeStatus(t.status)}</div>
        <div class="trx-baris"><span>Pembayaran</span>${t.status === 'dibatalkan' ? '<b>-</b>' : belumBayar(t) ? '<span class="trx-status belum_bayar">Belum Dibayar</span>' : '<span class="trx-status disiapkan">Lunas</span>'}</div>
      </section>
      <section class="bantuan-card trx-kartu">
        <h2>Rincian Pesanan</h2>
        <p class="trx-sub">Daftar item yang sudah ditambahkan ke transaksi ini.</p>
        ${t.items.map((i) => `
          <div class="trx-rincian num">
            <div class="menu-item-baris"><b>${esc(i.nama_barang)}</b><b>${rupiah(i.harga_satuan)}</b></div>
            <div class="menu-item-baris"><span>Jumlah: <b>${angka(i.jumlah)}</b></span><span>Subtotal <b>${rupiah(i.subtotal)}</b></span></div>
          </div>`).join('')}
      </section>
      <section class="bantuan-card trx-kartu">
        <h2>Pembayaran</h2>
        <p class="trx-sub">Ringkasan pembayaran dan kembalian dari transaksi ini.</p>
        ${baris('Subtotal Pesanan', rupiah(t.total))}
        ${baris('Pajak / Layanan (0%)', rupiah(0))}
        ${baris('Total Pembayaran', rupiah(t.total))}
        ${baris(tunai ? 'Uang Diterima (Rp)' : 'Uang Diterima', uang === null ? '-' : rupiah(uang))}
        ${baris('Kembalian', uang === null ? '-' : rupiah(uang - t.total))}
      </section>
      <section class="bantuan-card trx-kartu">
        <h2>Catatan</h2>
        <p class="trx-sub">Informasi tambahan yang ditinggalkan pelanggan.</p>
        <div class="trx-catatan-kotak ${t.catatan ? '' : 'kosong'}">${t.catatan ? esc(t.catatan) : 'Tidak ada catatan.'}</div>
      </section>
      ${t.status === 'belum_selesai' ? `
        <div class="trx-aksi-bawah">
          <button type="button" class="btn grow btn-batal" data-aksi="batal">Batalkan Pesanan</button>
          <button type="button" class="btn grow primary" data-aksi="selesai" ${belumBayar(t) ? 'disabled' : ''}>${belumBayar(t) ? 'Menunggu Bayar' : 'Tandai Selesai'}</button>
        </div>
        ${belumBayar(t) ? '<p class="trx-catatan-kaki">Pesanan dari meja bisa ditandai selesai setelah pembeli membayar QRIS.</p>' : ''}` : ''}`;

    app.querySelector('.trx-aksi-bawah')?.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-aksi]');
      if (!b) return;
      try {
        if (b.dataset.aksi === 'selesai') await tandaiSelesai(t);
        else if (!(await batalkan(t))) return;
        await muat();
      } catch (err) {
        toast(err.message, 'err');
        await muat();
      }
    });
  }
  try {
    await muat();
  } catch (err) {
    app.innerHTML = `<a href="${kembali}" class="btn-kembali">${ikon.kiri} Kembali ke Transaksi</a><div class="notice err">${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------------
// Halaman dengan pilihan tanggal (Menu Terlaris & Rekap)
// ---------------------------------------------------------------------
function kerangkaTanggal(app, { judul, sub, tanggal }) {
  app.innerHTML = `
    <a href="#/transaksi" class="btn-kembali">${ikon.kiri} Kembali ke Transaksi</a>
    <section class="bantuan-card trx-kartu"><h1 class="trx-judul">${judul}</h1><p class="trx-sub rapat">${sub}</p></section>
    ${tombolTanggal('pilih-tgl', tanggal)}
    <div id="isi"><p class="empty">Memuat…</p></div>`;
}
function pasangTanggal(app, path, nilai, muat) {
  const hariIni = sekarangWIB().tanggal;
  app.querySelector('#pilih-tgl').addEventListener('click', async () => {
    const t = await pilihTanggal({ nilai: nilai(), maks: hariIni });
    if (!t || t === nilai()) return;
    app.querySelector('#pilih-tgl span').textContent = tanggalBulanPanjang(t);
    setQuery(path, { tanggal: t });
    await muat(t);
  });
}
const kosong = (teks) => `<div class="bantuan-card trx-kosong">${ikonKosong}<p>${teks}</p></div>`;

// ---------- Periode menu terlaris: harian / mingguan (Senin–Minggu) / bulanan ----------
const PERIODE = [['hari', 'Harian'], ['minggu', 'Mingguan'], ['bulan', 'Bulanan']];
const BULAN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const keIso = (d) => d.toISOString().slice(0, 10);
const dariIso = (t) => new Date(`${t}T00:00:00Z`);

/** Rentang [dari, sampai] yang memuat `tanggal` untuk periode tertentu. */
function rentangPeriode(periode, tanggal) {
  const d = dariIso(tanggal);
  if (periode === 'minggu') {
    const geser = (d.getUTCDay() + 6) % 7; // 0 = Senin
    const senin = new Date(d); senin.setUTCDate(d.getUTCDate() - geser);
    const minggu = new Date(senin); minggu.setUTCDate(senin.getUTCDate() + 6);
    return [keIso(senin), keIso(minggu)];
  }
  if (periode === 'bulan') {
    const awal = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const akhir = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return [keIso(awal), keIso(akhir)];
  }
  return [tanggal, tanggal];
}

/** "17 November 2026" · "16–22 Nov 2026" · "30 Nov – 6 Des 2026" · "November 2026" */
function labelPeriode(periode, tanggal) {
  if (periode === 'hari') return tanggalBulanPanjang(tanggal);
  const [dari, sampai] = rentangPeriode(periode, tanggal);
  const [y1, m1, d1] = dari.split('-').map(Number);
  const [y2, m2, d2] = sampai.split('-').map(Number);
  if (periode === 'bulan') return `${BULAN_PANJANG[m1 - 1]} ${y1}`;
  if (y1 !== y2) return `${d1} ${BULAN_PENDEK[m1 - 1]} ${y1} – ${d2} ${BULAN_PENDEK[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${BULAN_PENDEK[m1 - 1]} – ${d2} ${BULAN_PENDEK[m2 - 1]} ${y2}`;
  return `${d1}–${d2} ${BULAN_PENDEK[m1 - 1]} ${y1}`;
}

async function terlaris(app, q) {
  const hariIni = sekarangWIB().tanggal;
  let tanggal = q.tanggal || hariIni;
  let periode = PERIODE.some(([k]) => k === q.periode) ? q.periode : 'hari';
  app.innerHTML = `
    <a href="#/transaksi" class="btn-kembali">${ikon.kiri} Kembali ke Transaksi</a>
    <section class="bantuan-card trx-kartu"><h1 class="trx-judul">Daftar Menu Terlaris</h1><p class="trx-sub rapat">Lihat daftar menu terlaris yang terjual per hari, minggu, atau bulan.</p></section>
    <nav class="periode-seg" id="periode" aria-label="Periode">
      ${PERIODE.map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === periode}">${l}</button>`).join('')}
    </nav>
    ${tombolTanggal('pilih-tgl', tanggal)}
    <div id="isi"><p class="empty">Memuat…</p></div>`;
  const isi = app.querySelector('#isi');
  const labelTombol = app.querySelector('#pilih-tgl span');

  async function muat() {
    labelTombol.textContent = labelPeriode(periode, tanggal);
    setQuery('transaksi/terlaris', periode === 'hari' ? { tanggal } : { periode, tanggal });
    const [dari, sampai] = rentangPeriode(periode, tanggal);
    const { menu } = await api(`/transaksi/terlaris?dari=${dari}&sampai=${sampai}`);
    const judulPeriode = periode === 'hari' ? 'hari ini' : periode === 'minggu' ? 'minggu ini' : 'bulan ini';
    isi.innerHTML = `
      ${menu.length ? `
        <section class="bantuan-card trx-kartu">
          <div class="trx-kartu-head"><h2>Seluruh Menu Terjual</h2><span class="small muted num">${angka(menu.length)} barang</span></div>
          <p class="trx-sub">${periode === 'hari' ? 'Diurutkan dari jumlah terjual terbanyak.' : `Total ${labelPeriode(periode, tanggal)}${sampai >= hariIni && dari <= hariIni ? ` (${judulPeriode}, sampai hari ini)` : ''}, diurutkan dari jumlah terjual terbanyak.`}</p>
          <ol class="trx-rank besar">${menu.map((m, i) => `
            <li><span class="rank-no">${i + 1}</span><div><b>${esc(m.nama_barang)}</b><span class="muted num">${angka(m.jumlah)} ${esc(m.satuan)} terjual</span></div></li>`).join('')}</ol>
        </section>` : `<h2 class="trx-h2">Seluruh Menu Terjual</h2>${kosong(periode === 'hari' ? 'Belum ada data menu yang terjual.' : `Belum ada data menu yang terjual pada ${labelPeriode(periode, tanggal)}.`)}`}
      <p class="trx-catatan-kaki">Hanya jumlah barang dari transaksi Selesai yang dihitung. Transaksi dibatalkan tidak dihitung.${periode === 'minggu' ? ' Satu minggu dihitung Senin–Minggu.' : ''}</p>`;
  }

  app.querySelector('#periode').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-p]');
    if (!b || b.dataset.p === periode) return;
    periode = b.dataset.p;
    app.querySelectorAll('#periode button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    await muat();
  });
  // Kalender: pilih tanggal mana pun; minggu/bulan yang memuat tanggal itu dipakai.
  app.querySelector('#pilih-tgl').addEventListener('click', async () => {
    const t = await pilihTanggal({ nilai: tanggal, maks: hariIni });
    if (!t || t === tanggal) return;
    tanggal = t;
    await muat();
  });
  await muat();
}

async function rekap(app, q) {
  let tanggal = q.tanggal || sekarangWIB().tanggal;
  kerangkaTanggal(app, { judul: 'Rekap Pemasukan', sub: 'Lihat ringkasan pemasukan dan transaksi warung.', tanggal });
  const isi = app.querySelector('#isi');
  async function muat(t) {
    tanggal = t;
    const { ringkasan: s, transaksi } = await api(`/transaksi?tanggal=${t}`);
    isi.innerHTML = `
      <section class="bantuan-card trx-kartu">
        <span class="trx-label">Total Pemasukan</span>
        <div class="menu-item-baris"><b class="trx-besar num">${rupiah(s.total)}</b><span class="small muted num">${angka(s.jumlah_dihitung)} transaksi</span></div>
        <div class="trx-dua kotak num">
          <div><span>Pemasukan Tunai</span><b>${rupiah(s.total_tunai)}</b></div>
          <div><span>Pemasukan QRIS</span><b>${rupiah(s.total_qris)}</b></div>
        </div>
      </section>
      <h2 class="trx-h2">Rincian Transaksi</h2>
      ${transaksi.length ? transaksi.map((x) => `
        <a class="bantuan-card trx-rekap-item ${x.status} ${belumBayar(x) ? 'belum-bayar' : ''}" href="#/transaksi/detail?id=${x.id_transaksi}&dari=rekap&tanggal=${t}">
          <div class="menu-item-baris">
            <span><b class="num">${jam(x)}</b> <span class="chip-metode">${metodeLabel(x.metode_bayar)}</span>${x.nama_meja ? ` <span class="chip-meja">${esc(x.nama_meja)}</span>` : ''}${x.status === 'dibatalkan' ? ' <span class="trx-status dibatalkan">Dibatalkan</span>' : belumBayar(x) ? ' <span class="trx-status belum_bayar">Belum Dibayar</span>' : ''}</span>
            <b class="num trx-nominal">${rupiah(x.total)}</b>
          </div>
          <span class="trx-rekap-baris num">${esc(kode(x))} · ${esc(namaPelanggan(x))}</span>
          <span class="trx-rekap-baris">${x.items.map((i) => `${esc(i.nama_barang)} ×${i.jumlah}`).join(' · ')}</span>
          <div class="menu-item-baris"><span class="trx-rekap-baris muted">${x.nama_meja ? 'Pesanan pembeli (QR)' : `Dicatat ${esc(x.pencatat)}`}</span><span class="trx-detail-link">Detail ›</span></div>
        </a>`).join('') : kosong('Belum ada data transaksi.')}
      ${s.dibatalkan || s.belum_bayar ? `<p class="trx-catatan-kaki">Tidak dihitung dalam total pemasukan: ${[s.dibatalkan ? `${angka(s.dibatalkan)} transaksi dibatalkan` : '', s.belum_bayar ? `${angka(s.belum_bayar)} pesanan belum dibayar` : ''].filter(Boolean).join(' dan ')}.</p>` : ''}`;
  }
  pasangTanggal(app, 'transaksi/rekap', () => tanggal, muat);
  await muat(tanggal);
}

