/* =====================================================================
   ABSEN PIKET PMR - SMK N 2 PATI
   Satu file JavaScript untuk semua halaman (anggota + admin).
   Isi bagian PENGATURAN di bawah, lalu selesai.
   ===================================================================== */

// ---------- PENGATURAN ------------------------------------------------
// Supabase > Project Settings > API. Kunci "anon" memang boleh publik.
// JANGAN pernah menaruh kunci "service_role" di sini.
const SUPABASE_URL = 'https://GANTI-DENGAN-URL-PROYEK.supabase.co';
const SUPABASE_ANON_KEY = 'GANTI-DENGAN-ANON-KEY';
const EMAIL_DOMAIN = 'pmr.smkn2pati.id'; // harus sama dengan import/import.js
const BUCKET = 'bukti';                   // nama bucket foto di Supabase Storage

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');
const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

// ---------- ALAT BANTU ------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toEmail = (u) => `${u.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
const $ = (id) => document.getElementById(id);

// Jam dalam WIB, contoh "15:32 WIB"
const jam = (iso) => new Date(iso).toLocaleTimeString('en-GB',
  { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + ' WIB';
// Tanggal "2026-11-18" -> "18 November 2026"
const tgl = (ymd) => new Date(ymd + 'T12:00:00Z').toLocaleDateString('id-ID',
  { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
const todayWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
// 1 = Senin ... 7 = Minggu
const isoDow = (ymd) => ((new Date(ymd + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
const geser = (ymd, hari) => {
  const d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
};

async function urlFoto(path) { // foto private -> link sementara (1 jam)
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 3600);
  return data ? data.signedUrl : '';
}
function bukaFoto(url) {
  if (!url) return;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.innerHTML = `<img src="${esc(url)}" alt="Foto bukti piket">`;
  box.onclick = () => box.remove();
  document.body.appendChild(box);
}

const ICON = {
  cross: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><path d="M12 4v16M4 12h16"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
};

// ---------- STATUS LOGIN & PERPINDAHAN HALAMAN ------------------------
let me = null; // profil pengguna yang sedang login {id, username, full_name, role}

async function muatProfil() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data } = await db.from('profiles').select('id,username,full_name,role')
    .eq('id', session.user.id).maybeSingle();
  return data;
}

const go = (p) => { if (location.hash === '#/' + p) route(); else location.hash = '#/' + p; };

function route() {
  stopCamera();
  const page = (location.hash || '').replace('#/', '');
  const isAdmin = me && me.role === 'admin';

  if (page === 'admin') return isAdmin ? go('dashboard') : viewAuth('admin');
  if (page === 'dashboard') return isAdmin ? viewDashboard() : go('admin');
  if (!me) return viewAuth('member');
  if (isAdmin) return go('dashboard');

  const halaman = { beranda: viewHome, absen: viewAbsen, riwayat: viewRiwayat, profil: viewProfil };
  (halaman[page] || viewHome)();
}

async function logout() {
  const wasAdmin = me && me.role === 'admin';
  await db.auth.signOut();
  me = null;
  go(wasAdmin ? 'admin' : 'login');
}

// ---------- LOGIN (anggota & admin memakai form yang sama) ------------
function viewAuth(role) {
  const admin = role === 'admin';
  app.innerHTML = `
    <main class="auth">
      <div class="logo">${ICON.cross}</div>
      <h1>${admin ? 'ADMIN PIKET PMR' : 'ABSEN PIKET PMR'}</h1>
      <p class="sub">SMK N 2 PATI</p>
      <form id="form" class="card">
        <label for="u">${admin ? 'USERNAME ADMIN' : 'USERNAME'}</label>
        <input id="u" autocomplete="username" autocapitalize="none" spellcheck="false" required>
        <label for="p">${admin ? 'PASSWORD ADMIN' : 'PASSWORD'}</label>
        <div class="pw">
          <input id="p" type="password" autocomplete="current-password" required>
          <button type="button" class="eye" id="eye" aria-label="Lihat atau sembunyikan password">${ICON.eye}</button>
        </div>
        <p class="err" id="err" role="alert"></p>
        <button class="btn" id="go">${admin ? 'Masuk sebagai Admin' : 'Masuk Sekarang →'}</button>
      </form>
      <a class="link" href="${admin ? '#/login' : '#/admin'}">${admin ? '← Kembali ke login anggota' : 'Login admin'}</a>
    </main>`;

  $('eye').onclick = () => { const p = $('p'); p.type = p.type === 'password' ? 'text' : 'password'; };

  $('form').onsubmit = async (e) => {
    e.preventDefault();
    const salah = admin ? 'Username atau password admin salah.' : 'Username atau password salah.';
    $('go').disabled = true; $('err').textContent = '';

    const { error } = await db.auth.signInWithPassword({ email: toEmail($('u').value), password: $('p').value });
    let prof = error ? null : await muatProfil();
    // akun anggota tidak boleh masuk lewat halaman admin, dan sebaliknya
    if (prof && prof.role !== role) { await db.auth.signOut(); prof = null; }

    if (!prof) { $('err').textContent = salah; $('go').disabled = false; return; }
    me = prof;
    go(admin ? 'dashboard' : 'beranda');
  };
}

// ---------- KERANGKA HALAMAN ANGGOTA ----------------------------------
function shell(aktif, isi) {
  const menu = [['beranda', 'Beranda', ICON.home], ['absen', 'Absen', ICON.cam],
                ['riwayat', 'Riwayat', ICON.clock], ['profil', 'Profil', ICON.user]];
  app.innerHTML = `
    <main class="wrap" id="main">${isi}</main>
    <nav class="bottom"><div class="in">
      ${menu.map(([k, t, i]) => `<a href="#/${k}" class="${k === aktif ? 'on' : ''}">${i}<span>${t}</span></a>`).join('')}
    </div></nav>`;
}
const setMain = (html) => { $('main').innerHTML = html; };

async function ambilHariIni() {
  const { data, error } = await db.rpc('my_today');
  if (error) { setMain(`<p class="err">Gagal memuat data: ${esc(error.message)}</p>`); return null; }
  return data;
}
function statusPiket(t) {
  if (!t.has_schedule) return { txt: 'Tidak Ada Jadwal', cls: 'gray' };
  if (t.attended) return { txt: 'Sudah Melaksanakan Piket', cls: 'green' };
  return { txt: 'Belum Absen', cls: 'amber' };
}
const barisInfo = (t) => `
  <div class="row"><span>Nama</span><span>${esc(me.full_name)}</span></div>
  <div class="row"><span>Hari</span><span>${HARI[t.dow - 1]}</span></div>
  <div class="row"><span>Tanggal</span><span>${tgl(t.date)}</span></div>
  <div class="row"><span>Sesi</span><span>${esc(t.session || '-')}</span></div>
  <div class="row"><span>Jadwal</span><span>${HARI[t.dow - 1]} • ${esc(t.session)}</span></div>`;

// ---------- BERANDA ----------------------------------------------------
async function viewHome() {
  shell('beranda', '<p class="muted">Memuat…</p>');
  const t = await ambilHariIni(); if (!t) return;
  const st = statusPiket(t);
  setMain(`
    <p class="hello">Selamat Datang 👋</p>
    <h1 class="name">${esc(me.full_name)}</h1>
    <section class="card">
      <h2 class="title">PIKET HARI INI</h2>
      <div class="row"><span>Tanggal</span><span>${tgl(t.date)}</span></div>
      <div class="row"><span>Hari</span><span>${HARI[t.dow - 1]}</span></div>
      <div class="row"><span>Sesi</span><span>${esc(t.session || '-')}</span></div>
      <div class="row"><span>Status</span><span><span class="badge ${st.cls}">${st.txt}</span></span></div>
      ${t.has_schedule && !t.attended ? '<a class="btn" style="display:block;text-align:center;text-decoration:none" href="#/absen">Absen Sekarang</a>' : ''}
    </section>`);
}

// ---------- ABSEN + KAMERA --------------------------------------------
let stream = null, photoBlob = null, photoUrl = null, hariIni = null;

function stopCamera() {
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
}
function buangFoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoBlob = null; photoUrl = null;
}

async function viewAbsen() {
  shell('absen', '<p class="muted">Memuat…</p>');
  buangFoto();
  hariIni = await ambilHariIni(); if (!hariIni) return;
  const t = hariIni;

  // Sudah absen -> tampilkan bukti, jangan beri tombol absen
  if (t.attended) {
    const url = await urlFoto(t.photo_path);
    setMain(`
      <h1 class="title">Absen Piket</h1>
      <section class="card">
        <p class="ok" style="margin:0 0 10px">Anda sudah melakukan absen piket hari ini.</p>
        <div class="row"><span>Waktu absen</span><span>${jam(t.att_time)}</span></div>
        <div class="row"><span>Status</span><span><span class="badge green">${esc(t.status)}</span></span></div>
        <div class="shot"><img src="${esc(url)}" alt="Foto bukti" id="bukti"></div>
      </section>`);
    $('bukti').onclick = () => bukaFoto(url);
    return;
  }
  // Tidak ada jadwal -> tidak boleh absen
  if (!t.has_schedule) {
    return setMain(`<h1 class="title">Absen Piket</h1>
      <section class="card"><p>Anda tidak memiliki jadwal piket hari ini.</p></section>`);
  }
  absenStep('info');
}

// Langkah: info -> camera -> review -> confirm -> done
function absenStep(step, pesan = '', data = null) {
  const t = hariIni;
  const err = pesan ? `<p class="err" role="alert">${esc(pesan)}</p>` : '';

  if (step === 'info') {
    setMain(`<h1 class="title">Absen Piket</h1>
      <section class="card">${barisInfo(t)}${err}
        <button class="btn" id="a">📷 Ambil Foto Bukti</button>
      </section>`);
    $('a').onclick = startCamera;
  }

  if (step === 'camera') {
    setMain(`<h1 class="title">Ambil Foto Bukti</h1>
      <div class="cam"><video id="video" playsinline muted autoplay></video></div>
      <button class="btn" id="snap">📷 Ambil Foto</button>
      <button class="btn ghost" id="batal">Batal</button>`);
    $('snap').onclick = ambilFoto;
    $('batal').onclick = () => { stopCamera(); absenStep('info'); };
  }

  if (step === 'review') {
    setMain(`<h1 class="title">Preview Foto</h1>
      <div class="cam"><img src="${photoUrl}" alt="Hasil foto"></div>
      <button class="btn" id="pakai">Gunakan Foto</button>
      <button class="btn ghost" id="ulang">Ambil Ulang</button>`);
    $('pakai').onclick = () => absenStep('confirm');
    $('ulang').onclick = startCamera;
  }

  if (step === 'confirm') {
    setMain(`<h1 class="title">Konfirmasi Piket</h1>
      <section class="card">
        <div class="row"><span>Nama</span><span>${esc(me.full_name)}</span></div>
        <div class="row"><span>Hari</span><span>${HARI[t.dow - 1]}</span></div>
        <div class="row"><span>Tanggal</span><span>${tgl(t.date)}</span></div>
        <div class="row"><span>Sesi</span><span>${esc(t.session)}</span></div>
        <div class="shot"><img src="${photoUrl}" alt="Foto bukti"></div>
        ${err}
        <button class="btn" id="ok">✓ Konfirmasi Absen</button>
        <button class="btn ghost" id="ulang">← Ambil Ulang Foto</button>
      </section>`);
    $('ok').onclick = konfirmasiAbsen;
    $('ulang').onclick = startCamera;
  }

  if (step === 'done') {
    setMain(`<section class="card success">
        <div class="tick">✓</div>
        <h2>Piket Berhasil Dicatat</h2>
        <p class="muted" style="margin-top:6px">${HARI[t.dow - 1]}, ${tgl(t.date)} • ${esc(data.session)}</p>
        <p style="margin-top:6px"><b>${jam(data.att_time)}</b></p>
        <a class="btn" style="display:block;text-decoration:none" href="#/riwayat">Lihat Riwayat</a>
      </section>`);
  }
}

async function startCamera() {
  buangFoto();
  absenStep('camera');
  try {
    // kamera depan (selfie) bila tersedia
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false,
    });
    const v = $('video'); v.srcObject = stream; await v.play();
  } catch (e) {
    stopCamera();
    absenStep('info', 'Kamera tidak dapat dibuka. Izinkan akses kamera di browser (situs harus memakai https), lalu coba lagi.');
  }
}

function ambilFoto() {
  const v = $('video');
  if (!v || !v.videoWidth) return;
  const skala = Math.min(1, 960 / Math.max(v.videoWidth, v.videoHeight)); // kecilkan agar ringan
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * skala); c.height = Math.round(v.videoHeight * skala);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  stopCamera();
  c.toBlob((b) => { photoBlob = b; photoUrl = URL.createObjectURL(b); absenStep('review'); }, 'image/jpeg', 0.8);
}

async function konfirmasiAbsen() {
  if (!photoBlob) return absenStep('info', 'Foto bukti diperlukan untuk melakukan absen.');
  $('ok').disabled = true;
  const gagal = (m) => absenStep('confirm', m);

  // 1) unggah foto ke folder milik sendiri
  const path = `${me.id}/${hariIni.date}-${Date.now()}.jpg`;
  const up = await db.storage.from(BUCKET).upload(path, photoBlob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) return gagal('Foto gagal diunggah. Pastikan Anda punya jadwal hari ini dan belum absen. (' + up.error.message + ')');

  // 2) catat absensi; server memeriksa jadwal, absen ganda, dan keberadaan foto
  const { data, error } = await db.rpc('submit_attendance', { p_photo_path: path });
  if (error) return gagal(error.message);
  buangFoto();
  absenStep('done', '', data);
}

// ---------- RIWAYAT ----------------------------------------------------
async function viewRiwayat() {
  shell('riwayat', '<p class="muted">Memuat…</p>');
  // RLS: anggota hanya bisa membaca baris miliknya sendiri
  const { data, error } = await db.from('attendance')
    .select('att_date,day_name,session,att_time,photo_path,status').order('att_date', { ascending: false });
  if (error) return setMain(`<p class="err">${esc(error.message)}</p>`);
  if (!data.length) return setMain('<h1 class="title">Riwayat</h1><section class="card"><p class="muted">Belum ada riwayat piket.</p></section>');

  const { data: urls } = await db.storage.from(BUCKET).createSignedUrls(data.map((r) => r.photo_path), 3600);
  const peta = Object.fromEntries((urls || []).map((u) => [u.path, u.signedUrl]));

  setMain(`<h1 class="title">Riwayat</h1>` + data.map((r) => `
    <section class="card item">
      <h3>${tgl(r.att_date)}</h3>
      <p class="when">${esc(r.day_name)} • ${esc(r.session)}</p>
      <span class="badge green">✓ Sudah Melaksanakan Piket</span>
      <div class="row" style="margin-top:8px"><span>Jam</span><span>${jam(r.att_time)}</span></div>
      <p class="muted" style="margin-top:8px">Foto Bukti</p>
      <img class="thumb" src="${esc(peta[r.photo_path] || '')}" data-url="${esc(peta[r.photo_path] || '')}" alt="Foto bukti">
    </section>`).join(''));
  document.querySelectorAll('.thumb').forEach((im) => { im.onclick = () => bukaFoto(im.dataset.url); });
}

// ---------- PROFIL & GANTI PASSWORD -----------------------------------
async function viewProfil() {
  shell('profil', '<p class="muted">Memuat…</p>');
  const { data: jadwal } = await db.from('schedule').select('day,session'); // hanya jadwal sendiri (RLS)
  const j = jadwal && jadwal[0];
  setMain(`
    <section class="card center">
      <div class="avatar">${esc(me.full_name.trim()[0].toUpperCase())}</div>
      <h2>${esc(me.full_name)}</h2>
      <p class="muted">@${esc(me.username)}</p>
    </section>
    <section class="card">
      <div class="row"><span>Nama lengkap</span><span>${esc(me.full_name)}</span></div>
      <div class="row"><span>Username</span><span>${esc(me.username)}</span></div>
      <div class="row"><span>Hari piket</span><span>${j ? HARI[j.day - 1] : 'Belum terhubung'}</span></div>
      <div class="row"><span>Sesi piket</span><span>${j ? esc(j.session) : '-'}</span></div>
      ${j ? '' : '<p class="muted" style="margin-top:10px;font-size:.88rem">Jadwal belum terhubung ke akun Anda. Hubungi admin.</p>'}
    </section>
    <section class="card">
      <h2 class="title">Ganti Password</h2>
      <form id="pw">
        <label for="old">Password Lama</label><input id="old" type="password" autocomplete="current-password">
        <label for="n1">Password Baru</label><input id="n1" type="password" autocomplete="new-password">
        <label for="n2">Konfirmasi Password Baru</label><input id="n2" type="password" autocomplete="new-password">
        <p id="msg" role="alert"></p>
        <button class="btn" id="save">Simpan Password</button>
      </form>
    </section>
    <button class="btn ghost" id="out">Keluar</button>`);

  $('out').onclick = logout;
  $('pw').onsubmit = async (e) => {
    e.preventDefault();
    const msg = (t, ok) => { $('msg').className = ok ? 'ok' : 'err'; $('msg').textContent = t; };
    const [lama, baru, konf] = [$('old').value, $('n1').value, $('n2').value];
    if (!baru) return msg('Password baru tidak boleh kosong.');
    if (baru.length < 6) return msg('Password baru minimal 6 karakter.');
    if (baru !== konf) return msg('Konfirmasi password baru tidak sama.');
    $('save').disabled = true;

    // cek password lama dengan mencoba login ulang
    const cek = await db.auth.signInWithPassword({ email: toEmail(me.username), password: lama });
    if (cek.error) { $('save').disabled = false; return msg('Password lama salah.'); }
    const { error } = await db.auth.updateUser({ password: baru });
    $('save').disabled = false;
    if (error) return msg('Gagal menyimpan: ' + error.message);
    $('pw').reset(); msg('Password berhasil diperbarui.', true);
  };
}

// ---------- DASHBOARD ADMIN -------------------------------------------
async function viewDashboard() {
  const f = { date: todayWIB(), sesi: '', status: '' };

  app.innerHTML = `
    <main class="wrap admin">
      <div class="top"><h1>DASHBOARD ADMIN</h1><button class="btn small ghost" id="out">Keluar</button></div>
      <div class="stats" id="stats"></div>
      <section class="card">
        <h2 class="title">DATA PIKET</h2>
        <div class="filters">
          <div><label for="fd">Tanggal</label><input type="date" id="fd" value="${f.date}"></div>
          <div><label for="fh">Hari</label><select id="fh">${HARI.map((h, i) => `<option value="${i + 1}">${h}</option>`).join('')}</select></div>
          <div><label for="fs">Sesi</label><select id="fs"><option value="">Semua</option><option>Pagi</option><option>Sore</option></select></div>
          <div><label for="ft">Status</label><select id="ft"><option value="">Semua</option><option>Sudah Absen</option><option>Belum Absen</option></select></div>
        </div>
        <div class="tablewrap" style="margin-top:16px" id="tbl"></div>
      </section>
    </main>`;

  $('out').onclick = logout;
  $('fh').value = isoDow(f.date);

  // Ganti tanggal -> Hari ikut berubah. Ganti Hari -> tanggal pindah ke hari itu di minggu yang sama.
  $('fd').onchange = () => { if (!$('fd').value) return; f.date = $('fd').value; $('fh').value = isoDow(f.date); muat(); };
  $('fh').onchange = () => { f.date = geser(f.date, Number($('fh').value) - isoDow(f.date)); $('fd').value = f.date; muat(); };
  $('fs').onchange = () => { f.sesi = $('fs').value; tampil(); };
  $('ft').onchange = () => { f.status = $('ft').value; tampil(); };

  let rows = [], total = 0;

  async function muat() {
    $('tbl').innerHTML = '<p class="muted">Memuat…</p>';
    const [r, c] = await Promise.all([
      db.rpc('admin_piket', { p_date: f.date }),
      db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'member'),
    ]);
    if (r.error) { $('tbl').innerHTML = `<p class="err">${esc(r.error.message)}</p>`; return; }
    rows = r.data; total = c.count || 0;
    tampil();
  }

  function tampil() {
    const sudah = rows.filter((x) => x.status === 'Sudah Absen').length;
    $('stats').innerHTML = `
      <div class="stat"><small>Total Anggota</small><b>${total}</b></div>
      <div class="stat g"><small>Sudah Absen</small><b>${sudah}</b></div>
      <div class="stat r"><small>Belum Absen</small><b>${rows.length - sudah}</b></div>`;

    const lihat = rows.filter((x) => (!f.sesi || x.sesi === f.sesi) && (!f.status || x.status === f.status));
    if (!lihat.length) {
      $('tbl').innerHTML = `<p class="muted">${rows.length ? 'Tidak ada data untuk filter ini.' : 'Tidak ada jadwal piket pada tanggal ini.'}</p>`;
      return;
    }
    $('tbl').innerHTML = `<table>
      <thead><tr><th>Nama</th><th>Username</th><th>Hari</th><th>Sesi</th><th>Status</th><th>Jam</th><th>Bukti</th></tr></thead>
      <tbody>${lihat.map((x) => `<tr>
        <td>${x.nama ? esc(x.nama) : esc(x.panggilan) + ' <span class="badge gray">nama belum dicocokkan</span>'}</td>
        <td>${esc(x.username || '—')}</td>
        <td>${HARI[x.hari - 1]}</td>
        <td>${esc(x.sesi)}</td>
        <td>${x.status === 'Sudah Absen' ? '<span class="badge green">✓ Sudah Absen</span>' : '<span class="badge red">✕ Belum Absen</span>'}</td>
        <td>${x.jam ? jam(x.jam) : '—'}</td>
        <td>${x.foto ? `<button class="btn small" data-foto="${esc(x.foto)}">📷 Lihat Bukti</button>` : '—'}</td>
      </tr>`).join('')}</tbody></table>`;

    document.querySelectorAll('[data-foto]').forEach((b) => {
      b.onclick = async () => { b.disabled = true; bukaFoto(await urlFoto(b.dataset.foto)); b.disabled = false; };
    });
  }

  muat();
}

// ---------- MULAI -------------------------------------------------------
(async function init() {
  me = await muatProfil();
  window.addEventListener('hashchange', route);
  route();
})();
