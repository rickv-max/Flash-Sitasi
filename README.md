# Flash Sitasi v2.2 · Kota Otomatis + Panel Admin

Ruang kerja sitasi React + Vite, Firebase Authentication/Firestore, dan pembayaran bayar.gg melalui Vercel Functions.

## Mulai di sini

```bash
npm ci
cp .env.example .env
npm run dev
```

Buka alamat yang dicetak Vite. Tombol **Coba Demo Tanpa Akun** bisa digunakan tanpa kredensial. Demo memakai DOI `10.1038/nature14539` dan juga mendukung input manual. Riwayat demo hanya tersimpan di browser. Demo tidak membuat pembayaran dan tidak mengubah saldo akun.

Untuk mencoba akun/API secara lokal, isi variabel Firebase dan server di `.env`, lalu atur `APP_URL=http://localhost:5173` sesuai port Vite. Restart setelah mengubah `.env`. API lokal ditangani plugin Vite, sehingga tidak perlu proses server kedua. Callback pembayaran sebenarnya membutuhkan domain HTTPS yang dapat dijangkau bayar.gg; gunakan deployment Vercel untuk pengujian tersebut.

Node.js minimal **22.19**. Untuk Vercel, gunakan Node 22 atau 24 yang memenuhi versi minimum tersebut.

### Untuk pengguna Windows PowerShell

Jika `npm` diblokir karena `npm.ps1`, gunakan:

```powershell
npm.cmd ci
npm.cmd run dev
```

Tidak perlu mengubah execution policy. Saat mengganti source versi sebelumnya, pertahankan `.env` milik Anda.

## Tampilan

Versi ini mengembalikan **UI awal dari ZIP asli**: logo/video, Plus Jakarta Sans, tema putih–slate, landing page, sidebar Nomor DOI / Link Web-PDF / Mode Batch / Manual / Riwayat, formulir terpusat, dan tombol gelap. Desain ivory–hijau v2 sudah dihapus. Perbaikan pembayaran dan kontrol kredit server dari v2 dipertahankan.

## Kota terbit otomatis

Kolom **Kota Terbit** diisi otomatis setelah DOI/URL valid berhenti diketik selama satu detik. Pencarian preview tidak mengurangi kredit. Saat sitasi dibuat, server kembali menentukan kota yang dipakai dan menyimpannya bersama sumbernya di riwayat.

Urutan sumber:

1. Direktori terverifikasi admin, dengan prioritas ISSN → nama jurnal → URL jurnal OJS → nama penerbit.
2. Lokasi penerbit pada metadata Crossref.
3. Metadata kota dari halaman artikel, alamat `publisher` di JSON-LD atau microdata.
4. Alamat kontak jurnal/OJS dari maksimal dua halaman kontak dalam domain yang sama.

Tautan sumber ditampilkan di bawah kolom dan hasil sitasi. Kota dari alamat kontak diberi label **perlu diperiksa**, karena alamat redaksi dapat berbeda dari kota terbit. Sistem tidak mengambil kota dari afiliasi penulis dan tidak menebak lokasi kantor pusat hanya dari nama penerbit. Apabila sumber tidak tersedia, kolom tetap kosong dan dapat dilengkapi manual.

- Koreksi manual diprioritaskan; **Gunakan otomatis** mengembalikan hasil pencarian. Pergantian sumber membersihkan koreksi dari referensi sebelumnya.
- Form manual mendukung penerbit dan DOI opsional; tanpa DOI, nama jurnal/penerbit bisa dicocokkan dengan direktori admin.
- Batch mencari kota untuk setiap referensi. Kolom global hanya dipakai bila sengaja diisi untuk seluruh referensi.
- Kota dipakai di format footnote/daftar pustaka kustom. Format APA 7 tidak menambahkan kota.
- Hasil positif dicache 30 hari dan hasil kosong satu hari. Koreksi direktori admin langsung mengalahkan cache.
- Preview dibatasi 12 request per menit per akun. Fetch sumber membatasi alamat publik, redirect, ukuran, DNS, serta waktu total.

Tidak semua artikel/penerbit menyediakan kota yang dapat diverifikasi. Ini memperluas cakupan otomatis tanpa menjanjikan semua kota selalu ditemukan.

## Aktivasi admin pertama

1. Isi konfigurasi Firebase/client/server, lalu masuk sekali dengan akun Google yang akan menjadi pemilik utama.
2. Buka **Firebase Console → Authentication → Users**, salin **UID** akun tersebut.
3. Isi environment **server** `ADMIN_OWNER_UIDS=UID_ANDA`. Untuk beberapa pemilik, pisahkan dengan koma. Jangan gunakan awalan `VITE_`.
4. Restart dev server atau redeploy Vercel, lalu keluar dan masuk kembali. Server akan memberi akun UID tersebut peran `admin`.
5. Menu **Panel Admin** muncul di sidebar. Owner dapat menjadikan akun lain admin melalui **Pengguna → Lihat detail → Jadikan admin**.

Owner ditentukan dari konfigurasi server, bukan pengguna pertama yang mendaftar dan bukan email yang dikirim browser. Akun owner tidak dapat diblokir, diturunkan perannya, atau dicabut sesinya dari panel. Admin juga tidak dapat melakukan tindakan tersebut pada akun sendiri. Semua admin yang diberikan role memiliki seluruh akses panel; role ini tidak memakai kata sandi admin bersama.

### Migrasi profil versi lama

Profil baru langsung memiliki field role/status/pencarian. Profil lama diperbaiki saat masuk, tetapi jalankan backfill agar pengguna lama yang belum masuk juga muncul lengkap di filter dan ringkasan.

```bash
# Baca dan laporkan jumlah profil yang perlu dilengkapi:
npm run migrate:users
# Terapkan setelah proyek Firebase di .env sudah benar:
npm run migrate:users -- --apply
```

Di PowerShell, gunakan `npm.cmd run migrate:users` dan `npm.cmd run migrate:users -- --apply`. Script memakai kredensial server dari `.env`, berjalan bertahap 200 profil, dan dapat diulang. Script melengkapi field pencarian/peran/status/tanggal; saldo dan riwayat tidak diubah. Tanggal pembuatan yang tidak tersedia tetap ditampilkan sebagai `—`.

### Fitur admin

| Menu | Fungsi |
| --- | --- |
| Ringkasan | Jumlah akun, admin, akun diblokir, sitasi tersimpan, pembayaran lunas/tertunda, nilai paket terbayar, kredit beredar, aktivitas tujuh hari (WIB) |
| Pengguna | Pencarian awalan nama/email atau UID persis, filter role/status, halaman data, detail akun/login, 25 riwayat/mutasi/transaksi terbaru, catatan internal |
| Tindakan akun | Tambah/kurangi/tetapkan kredit, blokir/aktifkan akun, berikan/cabut admin, cabut sesi login |
| Transaksi | Filter UID/invoice/status/tanggal, periksa ulang ke bayar.gg, pengkreditan pembayaran terverifikasi yang belum masuk |
| Rekonsiliasi | Daftar request `unknown`/`creating`/`ready`, hubungkan invoice merchant ke request yang benar setelah minimal dua menit |
| Direktori Kota | Pemetaan ISSN/jurnal/URL jurnal/penerbit, kota dan URL sumber resmi wajib, aktifkan/nonaktifkan koreksi |
| Log Audit | Admin pelaksana, alasan, waktu, target, nilai sebelum/sesudah, filter tindakan/pengguna/tanggal |
| Pengaturan | Harga, kredit awal, batas top up/batch, buka/tutup pendaftaran, top up, kota otomatis, dan mode pemeliharaan |

Daftar memiliki pagination 25 data; **Ekspor halaman CSV** mengekspor halaman aktif sesuai filter dengan proteksi formula spreadsheet. Ringkasan menghitung data server sesungguhnya, tanpa angka contoh. Ringkasan sitasi menghitung riwayat yang masih tersimpan, bukan jumlah historis seumur hidup bila data lama dihapus. Nilai paket terbayar tidak memasukkan biaya/kode unik penyedia. `lastSeenAt` menunjukkan interaksi API terakhir, bukan indikator online real-time.

Perubahan admin membutuhkan alasan dan idempotency key. Perubahan saldo, ledger, dan audit ditulis dalam satu transaksi; retry tidak menggandakan kredit. Saldo akhir diperiksa terhadap saldo yang dilihat admin agar tidak menimpa transaksi baru. Hak admin diperiksa pada setiap API dan di dalam transaksi perubahan. Browser tidak dapat menulis role, saldo, pengaturan, atau audit.

Pemblokiran disimpan lebih dulu di database, lalu disinkronkan ke Firebase Auth dan sesi dicabut. Jika sinkronisasi Auth tertunda, akun tetap diblokir di API/rules; detail akun menampilkan pesan agar admin mengulangi tindakan. Pencabutan sesi diperiksa dari waktu autentikasi token pada API dan Firestore rules. Pengguna harus keluar lalu masuk lagi. Callback pembayaran tetap diproses saat pemeliharaan maupun akun diblokir agar transaksi yang sudah lunas tetap tercatat.

Panel admin dimuat terpisah saat dibuka dan mengikuti tampilan putih–slate awal. Tabel memiliki area scroll horizontal sendiri pada layar sempit; dialog dibatasi tinggi layar dan dapat di-scroll.

## Masalah pembayaran yang diperbaiki

1. Request lama tidak mengirim `payment_url`, padahal field itu wajib pada API bayar.gg saat diperiksa.
2. Parser lama hanya menerima `data.payment_url`. Versi ini menormalkan respons `data`, `payment`, dan root yang ditemukan di contoh dokumentasi.
3. Harga dihitung server dari jumlah kredit. Harga, identitas pelanggan, callback, dan redirect yang dikirim browser tidak dipercaya.
4. Pembayaran sebelumnya belum terhubung ke penambahan kredit. Sekarang ada webhook dengan pemeriksaan HMAC saat signature dikirim, verifikasi status langsung melalui API merchant, dan endpoint pemeriksaan status milik akun.
5. Kredit bertambah dalam transaksi database bersama penandaan invoice dan pencatatan ledger. Callback berulang dan pemeriksaan status secara bersamaan tidak menambah kredit dua kali.
6. Default pembelian minimal 10 kredit = Rp7.500; maksimal 500 kredit = Rp375.000, harga Rp750 per kredit. Admin dapat mengubahnya dalam rentang nominal Rp5.000–Rp500.000. Harga baru tidak mengubah invoice yang sudah dibuat.
7. API key pembayaran baru memakai variabel server `BAYAR_GG_API_KEY`. Untuk deployment lama dengan variabel Sensitive yang tidak dapat diubah namanya, server masih dapat memakai `VITE_BAYAR_GG_API_KEY`. Vite hanya mempublikasikan enam variabel Firebase client sehingga key pembayaran lama tetap tidak masuk ke client environment. `BAYAR_GG_API_KEY` diprioritaskan saat tersedia; pindahkan ke nama server tersebut saat memperbarui key. Jika kunci lama pernah masuk ke bundle browser versi terdahulu, regenerasi kunci tersebut di bayar.gg.
8. Timeout, respons HTML, respons tidak valid, dan penolakan penyedia mendapat pesan yang dapat dipahami. Request pembuatan invoice tidak diulang otomatis ketika hasilnya ambigu.

## Konfigurasi produksi

### 1. Firebase

Gunakan proyek Firebase aplikasi yang sama dengan versi sebelumnya agar akun, saldo, dan riwayat tetap tersambung.

- Aktifkan Authentication → Google.
- Tambahkan domain produksi ke Authentication → Authorized domains.
- Buat/aktifkan Cloud Firestore.
- Salin konfigurasi **Web App** ke keenam variabel `VITE_FIREBASE_*` di `.env.example`.
- Siapkan kredensial Firebase Admin di server menggunakan salah satu pilihan berikut:

| Pilihan | Variabel |
| --- | --- |
| JSON satu baris | `FIREBASE_SERVICE_ACCOUNT` berisi seluruh JSON service account |
| Tiga field terpisah | `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` |

Gunakan hanya salah satu pilihan. Untuk private key terpisah, newline asli atau literal `\n` didukung. Jangan beri awalan `VITE_` pada kredensial Admin.

Deploy aturan dan indeks dengan Firebase CLI yang sudah terpasang dan terautentikasi: `firebase deploy --only firestore:rules,firestore:indexes --project ID_PROYEK`. Konfigurasi disediakan di `firebase.json`, `firestore.rules`, dan `firestore.indexes.json`. Tunggu seluruh indeks selesai dibuat sebelum menggunakan filter admin. Field TTL `expireAt` memakai timestamp untuk membersihkan cache dan pembatas request; aktifkan kebijakan TTL yang disediakan jika diminta CLI/Firebase Console. Aturan ini hanya membolehkan pengguna membaca profil, riwayat, dan ledger sendiri. Browser tidak boleh mengubah saldo atau membuat riwayat berbayar. Jika proyek Firestore juga dipakai aplikasi lain, gabungkan aturan yang relevan dengan aturan aplikasi tersebut.

Profil baru memperoleh kredit sesuai pengaturan admin, default 5, melalui transaksi di server. Saldo profil yang sudah ada dipertahankan. Riwayat lama dengan field `footnote`, `dafpus`, `apaInText`, dan `apaRef` tetap bisa dibaca.

### 2. bayar.gg

Di pengaturan environment **server** Vercel, isi:

| Variabel | Isi |
| --- | --- |
| `APP_URL` | Origin aplikasi produksi, misalnya `https://flash-sitasi.vercel.app`, tanpa path/query |
| `BAYAR_GG_API_KEY` | API key akun merchant |
| `BAYAR_GG_WEBHOOK_SECRET` | **Webhook Secret Key** dari Developer → Webhook & Callback; berbeda dari API key |
| `BAYAR_GG_CHECKOUT_URL` | Default `https://www.bayar.gg/pay`, atau Checkout URL HTTPS aktif yang sama persis dengan konfigurasi merchant |
| `BAYAR_GG_PAYMENT_METHOD` | Opsional; misalnya `qris` jika tersedia di merchant. Kosong berarti dipilih penyedia dari metode yang tersedia. |

Pengaturan merchant:

1. Pastikan metode pembayaran yang dipilih benar-benar tersedia untuk akun. Syarat tiap metode berbeda.
2. Atur Default Callback URL menjadi `https://DOMAIN_APLIKASI/api/payment-webhook`. Aplikasi juga mengirim callback ini saat membuat invoice.
3. Pastikan Checkout URL yang dipakai aktif. `payment_url` berbeda dari `redirect_url`.
4. Callback harus dapat menerima POST JSON tanpa halaman login atau challenge browser. Periksa Callback Logs bila callback gagal.

Tanda tangan diverifikasi sesuai format resmi:

```text
HMAC-SHA256(invoice_id|status|final_amount|timestamp, WEBHOOK_SECRET)
```

Jika header signature dikirim, implementasi memeriksa `X-Webhook-Signature` dan `X-Webhook-Timestamp` dengan perbandingan konstan serta toleransi waktu 5 menit. Signature yang ada tetapi tidak valid ditolak. Dokumentasi API saat diperiksa menjelaskan HMAC, sementara contoh integrasi resmi yang lebih lama menjelaskan callback tanpa signature. Untuk kompatibilitas, callback tanpa header juga bisa diterima, tetapi **tidak pernah dijadikan bukti lunas**. Kedua jalur wajib memanggil `check-payment` memakai API key server, memeriksa invoice tercatat, status `paid`, serta nominal yang cocok sebelum kredit diberikan. Callback ganda tetap idempoten. Pastikan waktu server benar untuk callback bertanda tangan.

### 3. Deployment Vercel

Gunakan proyek Vercel aplikasi yang sama. Source frontend, `api/`, `server/`, dan `shared/` harus ikut di-deploy; jangan hanya mengunggah folder `dist`.

- Framework: Vite.
- Install: `npm ci`.
- Build: `npm run build`.
- Output: `dist`.
- `vercel.json` sudah menyertakan konfigurasi functions dan header dasar.
- Isi environment Production dan Preview sesuai domain masing-masing, kemudian redeploy.
- Jangan mengarahkan semua `/api/*` ke `index.html` melalui rewrite SPA; endpoint harus tetap diproses sebagai functions.
- Aktifkan aturan Firestore baru bersama rollout versi ini. Client lama yang menulis saldo langsung akan ditolak aturan baru.

### 4. Uji transaksi nyata setelah kredensial terpasang

1. Masuk dengan Google dan pastikan saldo akun terbaca.
2. Pilih 10 kredit, lalu buat tagihan. Harga paket harus Rp7.500; biaya/kode unik penyedia, jika ada, ditampilkan terpisah pada total tagihan.
3. Pastikan checkout bayar.gg terbuka dengan invoice dan nominal yang benar.
4. Selesaikan pembayaran melalui metode merchant yang aktif.
5. Kembali ke aplikasi. Kredit bertambah **10**, hanya setelah status diverifikasi server.
6. Gunakan **Saya sudah membayar, cek status** bila diperlukan. Pembukaan kembali dialog menggunakan invoice terakhir yang tersimpan pada browser dan akun tersebut.
7. Kirim ulang callback dari Callback Logs. Saldo harus tetap sama setelah pengkreditan pertama.
8. Coba gagal memproses DOI yang tidak ada. Saldo tidak berkurang.

## UI awal dan responsivitas

- Landing page, logo/video, tipografi, warna putih–slate, preview animasi, fitur, dan kartu harga mengikuti source awal.
- Workspace kembali ke sidebar dengan lima menu dan formulir terpusat selebar maksimal 760px.
- Paket top up kembali ke pilihan 50 / 75 / 100 / 125 kredit dan tombol gelap. Verifikasi status dan pemeriksaan pembayaran tetap tersedia dalam gaya visual yang sama.
- Batas mobile **768px** dipakai bersama oleh header menu, drawer, backdrop, tombol tutup, dan offset konten. Celah 640–768px pada versi awal diperbaiki.
- Sidebar yang tertutup tidak menerima fokus. Saat terbuka di mobile, fokus terperangkap di menu, Escape menutupnya, dan scroll halaman dikunci.
- Navigasi sidebar tetap bisa di-scroll pada layar pendek/landscape; footer kredit tetap dapat dijangkau.
- Scroll vertikal hanya dimiliki halaman; body dan root tidak membuat scrollbar tambahan. Lebar sidebar dan offset main tetap sinkron pada tablet/desktop.
- Formulir manual memakai satu kolom pada bidang sempit dan dua kolom pada layar besar. Pilihan format membungkus bila ruang tidak mencukupi.
- URL/sitasi panjang membungkus, tombol salin tetap terjangkau, input tidak memaksa lebar kartu, dan kolom mobile memakai 16px untuk mengurangi zoom otomatis.
- Dialog pembayaran dibatasi tinggi viewport dinamis dan bisa di-scroll di layar pendek. Toast dibatasi lebar layar serta menghormati safe area.
- Animasi GSAP gaya awal dipertahankan, timer preview dibersihkan saat ditutup, dan `prefers-reduced-motion` dihormati.
- Contoh sitasi pada preview memakai artikel nyata `10.1038/nature14539`.

CSS dasar desain awal ada di `src/App.css`. Perbaikan layout/breakpoint terpisah di `src/responsive.css`. Ini memudahkan penyesuaian responsif tanpa merombak desain lagi.

## Sitasi dan keamanan data

- DOI diambil melalui API Crossref dengan timeout. DOI di luar registri Crossref mungkin perlu ditangani lewat halaman penerbit atau input manual.
- Tautan artikel diproses dari metadata HTML penerbit di server. Tautan unduh OJS diarahkan ke halaman metadata artikel bila pola URL sesuai.
- Fetch ke sumber publik membatasi HTTPS, port, ukuran respons, redirect, dan alamat IP jaringan lokal. Hasil DNS divalidasi lalu dipasang pada koneksi yang digunakan.
- Tidak menggunakan proxy CORS publik atau klaim bypass proteksi situs. Halaman terlindungi dan PDF mentah tertentu dapat memerlukan DOI/input manual.
- Kredit hanya dipotong saat hasil dan riwayat berhasil disimpan dalam satu transaksi. Kegagalan ekstraksi tidak memerlukan refund dari browser.
- APA menyimpan seluruh daftar penulis yang tersedia; penanganan satu, dua, tiga, dan lebih dari 20 penulis dipisahkan. Nama dan judul tidak dipaksa menjadi Title Case.
- Metadata eksternal di-escape. UI tidak menggunakan `dangerouslySetInnerHTML`; riwayat lama ditampilkan sebagai teks aman dengan dukungan tag italic yang terbatas.
- Hasil mengikuti metadata sumber. Tetap cocokkan dengan pedoman kampus/jurnal dan periksa sumber asli.

## Pengujian

```bash
npm run lint
npm test
npm run build
# atau ketiganya:
npm run check
```

Pengujian juga mencakup sumber kota (metadata/JSON-LD/microdata/kontak), prioritas direktori/cache, pengabaian afiliasi penulis, preview gratis dan rate limit, bootstrap owner, penolakan role palsu, audit dan ledger atomik, konflik saldo, blokir/sinkronisasi Auth, pencabutan sesi, pencarian/pagination, rekonsiliasi, pengaturan dinamis, serta komponen admin responsif. Pengujian pembayaran mencakup normalisasi respons bayar.gg, URL checkout wajib, harga server, idempotensi invoice, signature palsu/kedaluwarsa, nominal tidak cocok, callback ganda, polling, kepemilikan tagihan, kegagalan metadata, saldo bersamaan, format APA, payload HTML berbahaya, validasi URL, render komponen tanpa browser, konsistensi breakpoint pada 320/360/390/640/700/768/769/1024/1440px, navigasi layar pendek, scroll root, serta batas tinggi dialog.

Saat paket difinalkan, 102 pengujian otomatis lulus. Lint tanpa error/warning dan build produksi juga lulus. `npm ci` dari lockfile baru berhasil.

Transaksi database diuji dengan adapter database dalam memori yang menjalankan transaksi secara serial dan rollback. Pengujian ini tidak menggantikan validasi aturan Firestore dengan emulator atau staging proyek asli.

**Batas verifikasi paket ini:** build produksi, lint, pengujian otomatis, dan server rendering komponen dapat dijalankan tanpa akun. Tidak ada kredensial merchant/Firebase pada lampiran, sehingga transaksi live, login Google pada domain deployment, serta callback produksi belum dijalankan. Layout responsif sudah diimplementasikan, tetapi belum diperiksa secara visual di browser pada lingkungan pengerjaan ini. Uji deployment asli pada lebar 320, 390, 768, 1024, dan 1440px sebelum rollout publik.

## Jika invoice gagal dibuat

| Gejala/kode | Pemeriksaan |
| --- | --- |
| `PAYMENT_CONFIG` | Isi API key, webhook secret, dan Checkout URL server. |
| `APP_CONFIG` | Periksa `APP_URL`, termasuk HTTPS dan tanpa path/query. |
| `AUTH_CONFIG` | Periksa kredensial Firebase Admin dan proyek Firebase. |
| `GATEWAY_REJECTED` | Periksa API key, metode aktif, Checkout URL, dan status akun merchant. |
| `GATEWAY_UNREACHABLE`, `GATEWAY_FORMAT`, `PAYMENT_PROCESSING` | Hasil request sebelumnya bisa ambigu. Jangan langsung membayar invoice lain; periksa dashboard merchant dan Callback Logs. |
| `AMOUNT_MISMATCH` | Nominal base/final tidak cocok dengan invoice tersimpan. Periksa invoice di merchant. Kredit tidak diberikan. |
| `PAYMENT_NOT_FOUND` pada callback | Invoice belum tercatat lokal atau berasal dari integrasi lain. Periksa request dan database sebelum mengulang callback. |
| `ADMIN_REQUIRED` | Pastikan UID owner terpasang di server, restart/redeploy dan login ulang; browser tidak dapat mengangkat diri sendiri. |
| `INDEX_REQUIRED` | Deploy firestore.indexes.json dan tunggu indeks berstatus Enabled. |
| `ACCOUNT_BLOCKED`, `SESSION_REVOKED` | Periksa status akun di panel admin; sesi yang dicabut memerlukan login ulang. |
| Riwayat/saldo tidak tersinkron | Pastikan akun dan proyek benar, rules terpasang, serta request `POST /api/profile` berhasil. |

Request pembayaran yang sudah dikirim tetapi berakhir timeout disimpan sebagai `paymentRequests.state=unknown` dan tidak otomatis dibuat ulang. Rekonsiliasi melalui dashboard merchant diperlukan bila invoice dibuat di penyedia tetapi respons tidak berhasil disimpan. Jangan menghapus penanda tersebut dan membuat invoice pengganti sebelum memastikan transaksi sebelumnya. Gunakan menu **Panel Admin → Rekonsiliasi** untuk menelusuri dan menghubungkan invoice yang sudah diverifikasi pada dashboard merchant. Nominal dan status diperiksa ulang ke bayar.gg sebelum tersimpan. Refund uang, pembatalan invoice pada penyedia, email transaksi, dan sengketa ditangani lewat layanan merchant; penyesuaian kredit admin tidak memindahkan uang.

## Susunan source

```text
api/                 Vercel Functions dan endpoint akun/sitasi/pembayaran
server/              Autentikasi/otorisasi, gateway, metadata/kota, repository admin/transaksi
shared/              Katalog harga, pemformatan dan sanitasi sitasi
src/components/      Preview awal, kota, dialog pembayaran, panel admin, komponen aksesibel
src/hooks/           Akun Firebase, preview kota, pengaturan, dan alur pembayaran
src/lib/             API client, Firebase client, dan storage
public/              Favicon dan aset asli
scripts/             Migrasi profil lama
firestore.rules      Otorisasi pembacaan/sesi dan larangan perubahan data dari client
firestore.indexes.json Indeks filter/aggregasi admin dan TTL cache/rate limit
.env.example         Konfigurasi public/server tanpa kredensial
vercel.json          Konfigurasi deployment
tests/              Pengujian perilaku dan keamanan
```

## Referensi integrasi

- [Dokumentasi resmi bayar.gg](https://www.bayar.gg/api-docs)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)

Dokumentasi bayar.gg diperiksa pada 18 Oktober 2026. Ketentuan merchant dan akses metode dapat berubah; cek dashboard akun yang digunakan.

## Halaman publik dan SEO

Halaman `/`, `/tentang`, `/kebijakan-privasi`, dan `/syarat-ketentuan` dirender menjadi HTML saat build. Informasi publik bisa dibaca tanpa JavaScript; fitur akun dan sitasi tetap memakai React. `scripts/prerender.mjs` hanya mengompilasi komponen dalam memori dan tidak menjalankan server HTTP, migrasi, atau akses database. Saat prerender, SDK Firebase browser tidak diinisialisasi.

Build menghasilkan `robots.txt`, `sitemap.xml`, canonical per halaman, metadata Open Graph/Twitter, serta data terstruktur WebSite, WebApplication, WebPage, dan Person. Identitas pembuat: **Ricky Maulana**, juga dikenal sebagai **Ricky Maulana Lumajang**. Preview memakai `noindex, nofollow`; hanya produksi yang dibuka untuk pengindeksan. Tautan kebijakan tersedia di footer dan ruang kerja. Isi halaman ada di `shared/site-content.js`; kanal kontak diarahkan ke profil resmi GitHub pembuat.

Sitemap produksi: `https://flash-sitasi.vercel.app/sitemap.xml`. Pemilik dapat mengirim sitemap dan meminta pengindeksan URL melalui Google Search Console setelah memverifikasi kepemilikan situs. Menyiapkan SEO dan sitemap tidak menjamin kapan Google mengindeks atau menentukan peringkat.

## Template footnote

Template khusus menggunakan pola `Penulis (Tahun) “Judul.” Nama Jurnal. Kota, Vol. X No. Y, Bulan Tahun. hal. X-Y. DOI.` Nama jurnal dicetak miring pada footnote. Daftar pustaka menggunakan nama penulis pertama yang dibalik, judul di dalam tanda kutip, jurnal, penerbit, kota, volume, nomor, dan bulan/tahun. DOI dan halaman tetap tersedia di metadata/footnote; template daftar pustaka mengikuti contoh tanpa keduanya. Spasi setelah tanda koma diseragamkan.

Kapitalisasi judul dan nama mengikuti metadata atau input manual, termasuk teks campuran seperti `eDNA`. Bulan dibaca dari metadata publikasi Crossref/HTML atau pilihan manual; bulan yang tidak diketahui tidak ditebak. APA 7 tetap terpisah. Riwayat yang memiliki metadata dapat ditampilkan/disalin dengan template terbaru tanpa menulis ulang data atau memotong kredit; riwayat lama tanpa metadata tetap dapat dibaca.
