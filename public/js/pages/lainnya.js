// Menu Lainnya: log penjualan, kelola barang, catatan waktu transaksi, keluar.
import { api, esc, rupiah, angka, toast, sesi, sekarangWIB, tanggalPanjang, setErr, clearErr, badgeStatus, inisial, kodePesanan, bukaSheet } from '../util.js';

export async function render(app, sub, q) {
  // Log penjualan lama dipindah ke halaman Transaksi › Rekap Pemasukan.
  if (sub === 'penjualan' || sub === 'transaksi') { location.replace(`#/transaksi/rekap${q.tanggal ? `?tanggal=${q.tanggal}` : ''}`); return; }
  if (sub === 'barang') return kelolaBarang(app, q);
  if (sub === 'waktu') return catatanWaktu(app);
  if (sub === 'meja') return kelolaMeja(app);
  return menu(app);
}

function kembali(judul) {
  return `<a href="#/lainnya" class="btn sm" style="margin-bottom:10px">‹ Lainnya</a><h1 class="page-title">${judul}</h1>`;
}

function menu(app) {
  const p = sesi.pengguna;
  app.innerHTML = `
    <h1 class="page-title">Lainnya</h1>
    <div class="card row">
      <span class="avatar">${esc(inisial(p.nama))}</span>
      <div class="grow"><b>${esc(p.nama)}</b><div class="small muted">${p.peran === 'admin' ? 'Admin' : 'Pegawai'} · tercatat sebagai pencatat</div></div>
      <button class="btn sm" id="keluar">Keluar</button>
    </div>
    <h2>Menu</h2>
    <ul class="list link-list">
      <li><a href="#/lainnya/meja"><span><b>Kelola meja &amp; QR</b><div class="small muted">Cetak QR meja untuk pemesanan pembeli</div></span></a></li>
      <li><a href="#/transaksi"><span><b>Riwayat transaksi</b><div class="small muted">Transaksi per hari, total QRIS &amp; tunai</div></span></a></li>
      <li><a href="#/lainnya/barang"><span><b>Kelola barang</b><div class="small muted">Tambah barang, ubah harga &amp; stok minimum</div></span></a></li>
      <li><a href="#/lainnya/waktu"><span><b>Catatan waktu transaksi</b><div class="small muted">Hasil ukur &lt; 30 detik di HP ini</div></span></a></li>
    </ul>
    <p class="small muted" style="margin-top:20px">Kasir &amp; Stok Warung Kampus · Kelompok 7 · prototype Sprint 2 (US-02, US-03, US-05)</p>`;
  // Konfirmasi memakai sheet di dalam aplikasi, bukan confirm() bawaan browser:
  // confirm() bisa diblokir (mis. browser di dalam aplikasi) sehingga Keluar tidak jalan.
  app.querySelector('#keluar').addEventListener('click', () => {
    const { el, tutup } = bukaSheet(`
      <h2>Keluar dari akun?</h2>
      <p class="small muted" style="margin:0 0 14px;line-height:1.5">Kamu akan keluar sebagai <b>${esc(p.nama)}</b>. Masuk lagi dengan email dan kata sandi admin untuk memakai aplikasi.</p>
      <div class="row">
        <button type="button" class="btn grow" data-aksi="batal">Batal</button>
        <button type="button" class="btn grow btn-bahaya" data-aksi="keluar">Ya, keluar</button>
      </div>`);
    el.querySelector('[data-aksi="batal"]').addEventListener('click', tutup);
    el.querySelector('[data-aksi="keluar"]').addEventListener('click', () => {
      tutup();
      window.dispatchEvent(new Event('warung:keluar'));
    });
  });
}

// ---------------------------------------------------------------------
// Kelola barang (nama unik — QA skenario 4)
// ---------------------------------------------------------------------
async function kelolaBarang(app) {
  app.innerHTML = `
    ${kembali('Kelola barang')}
    <div id="hasil"></div>
    <form class="card" id="f" novalidate>
      <h2 style="margin-top:0" id="judul">Tambah barang</h2>
      <input type="hidden" name="id">
      <div class="field"><label for="nama_barang">Nama barang</label><input class="input" id="nama_barang" name="nama_barang" maxlength="60" autocomplete="off"><div class="err" data-err="nama_barang"></div></div>
      <div class="two">
        <div class="field"><label for="satuan">Satuan</label><input class="input" id="satuan" name="satuan" list="satuan-list" placeholder="porsi, gelas, pcs" maxlength="20"><div class="err" data-err="satuan"></div></div>
        <div class="field"><label for="harga_jual">Harga jual (Rp)</label><input class="input num" id="harga_jual" name="harga_jual" inputmode="numeric" placeholder="0"><div class="err" data-err="harga_jual"></div></div>
      </div>
      <div class="two">
        <div class="field"><label for="stok_minimum">Stok minimum</label><input class="input num" id="stok_minimum" name="stok_minimum" inputmode="numeric" value="0"><div class="err" data-err="stok_minimum"></div></div>
        <div class="field" id="awal-box"><label for="stok_awal">Stok awal</label><input class="input num" id="stok_awal" name="stok_awal" inputmode="numeric" value="0"><div class="err" data-err="stok_awal"></div></div>
      </div>
      <div class="field hidden" id="aktif-box"><label><input type="checkbox" name="aktif"> Masih dijual (aktif)</label>
        <div class="hint">Sisa stok tidak bisa diubah di sini — gunakan Stok Masuk / Stok Keluar supaya riwayatnya tercatat.</div></div>
      <div class="row"><button class="btn primary grow" type="submit" id="simpan">Tambah barang</button><button class="btn hidden" type="button" id="batal">Batal</button></div>
      <datalist id="satuan-list"><option>porsi</option><option>gelas</option><option>botol</option><option>pcs</option><option>bungkus</option></datalist>
    </form>
    <h2>Semua barang</h2>
    <ul class="list" id="list"></ul>`;

  const f = app.querySelector('#f');
  const hasil = app.querySelector('#hasil');
  let semua = [];

  function modeTambah() {
    f.reset(); f.id.value = '';
    app.querySelector('#judul').textContent = 'Tambah barang';
    app.querySelector('#simpan').textContent = 'Tambah barang';
    app.querySelector('#batal').classList.add('hidden');
    app.querySelector('#awal-box').classList.remove('hidden');
    app.querySelector('#aktif-box').classList.add('hidden');
    clearErr(f);
  }
  function modeUbah(b) {
    f.id.value = b.id_barang;
    f.nama_barang.value = b.nama_barang; f.satuan.value = b.satuan;
    f.harga_jual.value = b.harga_jual; f.stok_minimum.value = b.stok_minimum; f.aktif.checked = b.aktif;
    app.querySelector('#judul').textContent = `Ubah: ${b.nama_barang}`;
    app.querySelector('#simpan').textContent = 'Simpan perubahan';
    app.querySelector('#batal').classList.remove('hidden');
    app.querySelector('#awal-box').classList.add('hidden');
    app.querySelector('#aktif-box').classList.remove('hidden');
    clearErr(f);
    f.scrollIntoView({ behavior: 'smooth' });
  }

  async function muat() {
    semua = await api('/barang?semua=1');
    app.querySelector('#list').innerHTML = semua.map((b) => `
      <li class="row" data-id="${b.id_barang}" style="cursor:pointer">
        <div class="grow"><b>${esc(b.nama_barang)}</b> ${b.aktif ? badgeStatus(b.status) : '<span class="badge netral">Nonaktif</span>'}
          <div class="small muted num">${rupiah(b.harga_jual)} / ${esc(b.satuan)} · stok ${angka(b.stok_saat_ini)} · min ${angka(b.stok_minimum)}</div></div>
        <span class="muted">Ubah ›</span>
      </li>`).join('');
  }

  app.querySelector('#list').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    if (li) modeUbah(semua.find((b) => b.id_barang === Number(li.dataset.id)));
  });
  app.querySelector('#batal').addEventListener('click', modeTambah);

  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErr(f); hasil.innerHTML = '';
    const body = { nama_barang: f.nama_barang.value, satuan: f.satuan.value, harga_jual: f.harga_jual.value, stok_minimum: f.stok_minimum.value };
    // Cek nama ganda di form juga (server tetap mengecek).
    const nama = f.nama_barang.value.replace(/\s+/g, ' ').trim().toLowerCase();
    const dobel = semua.find((b) => b.nama_barang.toLowerCase() === nama && String(b.id_barang) !== f.id.value);
    if (dobel) { setErr(f, 'nama_barang', `Barang bernama "${dobel.nama_barang}" sudah ada. Gunakan barang itu atau beri nama lain.`); return; }
    try {
      let b;
      if (f.id.value) {
        b = await api(`/barang/${f.id.value}`, { method: 'PATCH', body: { ...body, aktif: f.aktif.checked } });
        toast('Perubahan barang tersimpan', 'ok');
      } else {
        b = await api('/barang', { method: 'POST', body: { ...body, stok_awal: f.stok_awal.value } });
        toast('Barang ditambahkan', 'ok');
      }
      hasil.innerHTML = `<div class="notice ok">${esc(b.nama_barang)} tersimpan · stok ${angka(b.stok_saat_ini)} ${esc(b.satuan)}.</div>`;
      modeTambah();
      await muat();
    } catch (err) {
      if (err.field && f.querySelector(`[data-err="${err.field}"]`)) setErr(f, err.field, err.message);
      else hasil.innerHTML = `<div class="notice err">${esc(err.message)}</div>`;
    }
  });

  await muat();
}

// ---------------------------------------------------------------------
// Catatan waktu transaksi (untuk uji < 30 detik, tersimpan di HP ini)
// ---------------------------------------------------------------------
function catatanWaktu(app) {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem('warung.waktuTransaksi') || '[]'); } catch { /* */ }
  const lolos = arr.filter((x) => x.detik < 30).length;
  app.innerHTML = `
    ${kembali('Catatan waktu transaksi')}
    <p class="muted small">Diukur otomatis dari membuka halaman Pesanan baru sampai transaksi tersimpan. Target &lt; 30 detik. Data ini hanya tersimpan di HP/browser ini.</p>
    ${arr.length ? `
      <div class="stats">
        <div class="stat"><span>Lolos &lt; 30 dtk</span><b class="num">${lolos} / ${arr.length}</b></div>
        <div class="stat"><span>Rata-rata</span><b class="num">${(arr.reduce((s, x) => s + x.detik, 0) / arr.length).toFixed(1)} dtk</b></div>
      </div>
      <ul class="list">${arr.map((x) => `
        <li class="row"><div class="grow"><b class="num">#${esc(x.kode || x.id_transaksi)}</b> · ${x.item} jenis item · ${String(x.metode).toUpperCase()}<div class="small muted">${esc(x.waktu)}</div></div>
        <span class="badge ${x.detik < 30 ? 'aman' : 'habis'} num">${x.detik} dtk</span></li>`).join('')}</ul>
      <button class="btn block" id="hapus" style="margin-top:12px">Hapus catatan</button>`
    : '<p class="empty">Belum ada transaksi yang diukur di HP ini.</p>'}`;
  app.querySelector('#hapus')?.addEventListener('click', () => {
    try { localStorage.removeItem('warung.waktuTransaksi'); } catch { /* */ }
    catatanWaktu(app);
  });
}

// ---------------------------------------------------------------------
// Kelola meja & QR (pembeli scan QR meja untuk memesan)
// ---------------------------------------------------------------------
async function kelolaMeja(app) {
  app.innerHTML = `
    ${kembali('Kelola meja &amp; QR')}
    <p class="small muted" style="margin:-4px 2px 12px;line-height:1.5">Tempel QR di tiap meja. Pembeli yang men-scan QR bisa memesan dan membayar QRIS dari meja itu.</p>
    <div id="alamat"></div>
    <form class="bantuan-card meja-tambah" id="f-tambah" novalidate>
      <input class="input" name="nama_meja" maxlength="30" placeholder="Nama meja baru, mis. Meja 6" aria-label="Nama meja baru" autocomplete="off">
      <button class="btn primary" type="submit">Tambah</button>
    </form>
    <div class="row" style="margin-bottom:12px;flex-wrap:wrap">
      <button class="btn sm" type="button" id="cetak-semua">Cetak semua QR aktif</button>
      <a class="btn sm" href="/" target="_blank" rel="noopener">Lihat halaman tamu</a>
    </div>
    <div class="meja-list" id="list"><p class="empty">Memuat…</p></div>`;

  const listEl = app.querySelector('#list');
  const lembar = document.createElement('div');
  lembar.className = 'lembar-cetak';
  document.body.appendChild(lembar);
  let data = { meja: [], alamat_dasar: '' };

  async function muat() {
    data = await api('/meja');
    app.querySelector('#alamat').innerHTML = `
      <div class="notice warn" style="font-weight:500;font-size:.85rem">
        QR berisi alamat <b>${esc(data.alamat_dasar)}</b>. HP pembeli harus terhubung ke Wi-Fi yang sama dengan laptop ini.
        Bila alamatnya salah, isi <b>BASE_URL</b> di berkas .env.
      </div>`;
    listEl.innerHTML = data.meja.map((m) => `
      <article class="bantuan-card meja-kartu ${m.aktif ? '' : 'nonaktif'}" data-id="${m.id_meja}">
        <div class="meja-qr">
          ${m.aktif ? `<img src="/qr/meja/${esc(m.kode)}.svg?v=${esc(m.kode)}" alt="QR ${esc(m.nama_meja)}" width="112" height="112">` : '<div class="meja-qr-mati"></div>'}
          <div>
            <b>${esc(m.nama_meja)}</b>
            <span class="${m.aktif ? 'status-pill buka' : 'status-pill tutup'}"><i></i>${m.aktif ? 'Aktif' : 'Nonaktif'}</span>
            ${m.aktif ? `<span class="meja-link">${esc(m.link)}</span>` : '<span class="meja-link">QR meja ini tidak bisa dipakai memesan.</span>'}
          </div>
        </div>
        <div class="meja-aksi">
          <button type="button" class="btn-kecil blok" data-aksi="cetak" ${m.aktif ? '' : 'disabled'}>Cetak QR</button>
          <button type="button" class="btn-kecil blok garis" data-aksi="kode">Ganti Kode</button>
          <button type="button" class="btn-kecil blok garis" data-aksi="aktif">${m.aktif ? 'Nonaktifkan' : 'Aktifkan'}</button>
        </div>
      </article>`).join('') || '<p class="empty">Belum ada meja.</p>';
  }

  function cetak(daftar) {
    if (!daftar.length) { toast('Tidak ada meja aktif untuk dicetak.', 'err'); return; }
    lembar.innerHTML = daftar.map((m) => `
      <div class="kartu-cetak">
        <h2>${esc(m.nama_meja)}</h2>
        <img src="/qr/meja/${esc(m.kode)}.svg?v=${esc(m.kode)}" alt="">
        <p><b>Dapoer Bu Mimin</b><br>Scan untuk lihat menu &amp; memesan</p>
        <small>${esc(m.link)}</small>
      </div>`).join('');
    const gambar = [...lembar.querySelectorAll('img')];
    Promise.all(gambar.map((g) => (g.complete ? 1 : new Promise((r) => { g.onload = g.onerror = r; })))).then(() => {
      document.body.classList.add('mode-cetak');
      window.print();
      document.body.classList.remove('mode-cetak');
    });
  }

  function konfirmasiKodeBaru(m) {
    return new Promise((selesai) => {
      let ya = false;
      const { el, tutup } = bukaSheet(`
        <h2>Ganti kode QR ${esc(m.nama_meja)}?</h2>
        <p class="small muted" style="margin:0 0 14px;line-height:1.5">QR lama yang sudah ditempel langsung <b>tidak berlaku</b>. Cetak dan tempel QR baru setelah ini. Gunakan bila QR lama tersebar ke luar warung.</p>
        <div class="row"><button type="button" class="btn grow" data-x="tidak">Batal</button><button type="button" class="btn grow btn-bahaya" data-x="ya">Ya, ganti kode</button></div>`,
      { onClose: () => selesai(ya) });
      el.querySelector('[data-x="tidak"]').addEventListener('click', tutup);
      el.querySelector('[data-x="ya"]').addEventListener('click', () => { ya = true; tutup(); });
    });
  }

  listEl.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-aksi]');
    if (!b || b.disabled) return;
    const m = data.meja.find((x) => x.id_meja === Number(b.closest('[data-id]').dataset.id));
    try {
      if (b.dataset.aksi === 'cetak') return cetak([m]);
      if (b.dataset.aksi === 'kode') {
        if (!(await konfirmasiKodeBaru(m))) return;
        await api(`/meja/${m.id_meja}/kode-baru`, { method: 'POST', body: {} });
        toast(`Kode QR ${m.nama_meja} diganti. Cetak QR barunya.`, 'ok');
      }
      if (b.dataset.aksi === 'aktif') {
        await api(`/meja/${m.id_meja}`, { method: 'PATCH', body: { aktif: !m.aktif } });
        toast(`${m.nama_meja} ${m.aktif ? 'dinonaktifkan' : 'diaktifkan'}`, 'ok');
      }
      await muat();
    } catch (err) { toast(err.message, 'err'); }
  });

  app.querySelector('#cetak-semua').addEventListener('click', () => cetak(data.meja.filter((m) => m.aktif)));

  const f = app.querySelector('#f-tambah');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nama = f.nama_meja.value.trim();
    if (!nama) { toast('Isi nama meja dulu.', 'err'); f.nama_meja.focus(); return; }
    try {
      await api('/meja', { method: 'POST', body: { nama_meja: nama } });
      f.reset();
      toast(`${nama} ditambahkan`, 'ok');
      await muat();
    } catch (err) { toast(err.message, 'err'); }
  });

  await muat();
  return () => lembar.remove();
}
