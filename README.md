# Flash Sitasi · Paket Kredit + Panel Admin

Ruang kerja sitasi React + Vite, Firebase Authentication/Firestore, dan pembayaran QRIS DOKU melalui Vercel Functions. Tagihan bayar.gg lama tetap didukung.

## Mulai di sini

```bash
npm ci
cp .env.example .env
npm run dev
```

Buka alamat yang dicetak Vite. Tombol **Coba Demo Tanpa Akun** bisa digunakan tanpa kredensial. Demo memakai DOI `10.1038/nature14539` dan juga mendukung input manual. Riwayat demo hanya tersimpan di browser. Demo tidak membuat pembayaran dan tidak mengubah saldo akun.

Untuk mencoba akun/API secara lokal, isi variabel Firebase dan server di `.env`, lalu atur `APP_URL=http://localhost:5173` sesuai port Vite. Restart setelah mengubah `.env`. API lokal ditangani plugin Vite, sehingga tidak perlu proses server kedua. Callback pembayaran sebenarnya membutuhkan domain HTTPS yang dapat dijangkau DOKU; gunakan deployment Vercel untuk pengujian tersebut.

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
| Transaksi | Filter UID/invoice/status/tanggal, periksa ulang ke penyedia asli tagihan, pengkreditan pembayaran terverifikasi yang belum masuk |
| Rekonsiliasi | Daftar request `unknown`/`creating`/`ready`, hubungkan invoice merchant ke request yang benar setelah minimal dua menit |
| Direktori Kota | Pemetaan ISSN/jurnal/URL jurnal/penerbit, kota dan URL sumber resmi wajib, aktifkan/nonaktifkan koreksi |
| Log Audit | Admin pelaksana, alasan, waktu, target, nilai sebelum/sesudah, filter tindakan/pengguna/tanggal |
| Pengaturan | Harga, kredit awal, batas top up/batch, buka/tutup pendaftaran, top up, kota otomatis, dan mode pemeliharaan |

### Paket kredit sekali beli

| Pilihan | Kredit | Harga awal |
| --- | ---: | ---: |
| Satuan | Sesuai jumlah yang dipilih | Rp750 per kredit |
| Pro | 199 | Rp115.000 |
| Plus | 499 | Rp299.000 |
| Sultan | 999 | Rp500.000 |

Semua paket adalah pembelian kredit, tanpa langganan bulanan/tahunan. Di **Panel Admin → Pengaturan**, harga satuan dan ketiga harga paket dapat diubah terpisah. Kuota paket tetap; batas top up satuan tidak membatasi paket Sultan.

`settings/app` menyimpan `pricePerCredit`, `proPackagePrice`, `plusPackagePrice`, dan `sultanPackagePrice`. Dokumen lama otomatis memakai harga paket awal sehingga tidak membutuhkan migrasi. Perubahan admin langsung menyegarkan harga di tab yang sama dan tab lain; pengunjung lain mendapat harga terbaru saat fokus atau dalam 20 detik. Server selalu menghitung nominal dari pengaturan; bila harga berubah sebelum checkout, pengguna diminta meninjau harga baru. Tagihan yang sudah dibuat mempertahankan nominal aslinya.

Pembelian baru memakai DOKU Checkout dengan `payment.payment_method_types=["QRIS"]`. Nominal berasal dari pengaturan admin dan dikirim tanpa kode unik tambahan aplikasi. `/api/payment-options` hanya mengembalikan provider, mode, batas nominal aplikasi, dan kesiapan konfigurasi. Status `configured` menunjukkan kredensial server telah diisi, bukan konfirmasi bahwa DOKU sudah mengaktifkan QRIS merchant. Aktivasi QRIS tetap harus diperiksa di dashboard DOKU. Tanpa konfigurasi lengkap, tombol beli dinonaktifkan dan menampilkan pesan kesiapan. Harga dan kuota paket tetap ditampilkan. Batas aplikasi untuk QRIS DOKU adalah Rp1.000–Rp5.000.000; batas merchant yang disetujui DOKU tetap berlaku.

Daftar memiliki pagination 25 data; **Ekspor halaman CSV** mengekspor halaman aktif sesuai filter dengan proteksi formula spreadsheet. Ringkasan menghitung data server sesungguhnya, tanpa angka contoh. Ringkasan sitasi menghitung riwayat yang masih tersimpan, bukan jumlah historis seumur hidup bila data lama dihapus. Nilai paket terbayar tidak memasukkan biaya/kode unik penyedia. `lastSeenAt` menunjukkan interaksi API terakhir, bukan indikator online real-time.

Perubahan admin membutuhkan alasan dan idempotency key. Perubahan saldo, ledger, dan audit ditulis dalam satu transaksi; retry tidak menggandakan kredit. Saldo akhir diperiksa terhadap saldo yang dilihat admin agar tidak menimpa transaksi baru. Hak admin diperiksa pada setiap API dan di dalam transaksi perubahan. Browser tidak dapat menulis role, saldo, pengaturan, atau audit.

Pemblokiran disimpan lebih dulu di database, lalu disinkronkan ke Firebase Auth dan sesi dicabut. Jika sinkronisasi Auth tertunda, akun tetap diblokir di API/rules; detail akun menampilkan pesan agar admin mengulangi tindakan. Pencabutan sesi diperiksa dari waktu autentikasi token pada API dan Firestore rules. Pengguna harus keluar lalu masuk lagi. Callback pembayaran tetap diproses saat pemeliharaan maupun akun diblokir agar transaksi yang sudah lunas tetap tercatat.

Panel admin dimuat terpisah saat dibuka dan mengikuti tampilan putih–slate awal. Tabel memiliki area scroll horizontal sendiri pada layar sempit; dialog dibatasi tinggi layar dan dapat di-scroll.

## Verifikasi pembayaran

- Server menghitung harga, kuota, identitas pelanggan, URL kembali, dan URL notifikasi. Browser tidak menentukan nominal tagihan.
- Pembuatan DOKU Checkout memakai invoice deterministik berdasarkan UID dan idempotency key, signature HMAC-SHA256 Non-SNAP, serta QRIS saja. Response signature, invoice, mata uang, nominal, metode, dan domain checkout diperiksa sebelum tautan disimpan.
- Notifikasi DOKU diverifikasi terhadap **byte body asli**, Client ID, Request ID, timestamp, path `/api/doku-webhook`, dan Secret Key. Hanya `transaction.status=SUCCESS` dari QRIS dengan nominal yang sesuai dapat dikreditkan. Redirect browser tidak membuktikan pembayaran.
- Kredit, badge dan ledger tersimpan dalam satu transaksi database. Notifikasi berulang dan polling bersamaan tidak menggandakan kredit. Notifikasi terlambat tetap dapat diverifikasi; invoice yang sudah diproses tidak dikreditkan ulang.
- Pemeriksaan cadangan DOKU dibatasi 60 detik per tagihan, dimulai setelah satu menit. `Not Found` untuk checkout baru yang sudah tercatat tetap diperlakukan sebagai menunggu. Status awal checkout tidak disamakan dengan pembayaran berhasil.
- Mode `sandbox` memakai endpoint DOKU sandbox dan selalu ditandai sebagai pengujian. Pembayaran sandbox tidak menambah saldo, badge, pendapatan, atau ledger top up, sekalipun Firebase yang digunakan sama dengan aplikasi produksi.
- Provider, mode, dan Client ID asal disimpan bersama invoice. Perubahan konfigurasi tidak mengalihkan tagihan lama ke penyedia atau akun yang berbeda. Kredensial bayar.gg lama masih diperlukan untuk tagihan bayar.gg lama.
- POST pembuatan invoice tidak diulang otomatis saat timeout, respons rusak, signature tidak valid, atau respons duplikat 409. Request tetap tercatat untuk rekonsiliasi admin, termasuk nomor invoice DOKU yang diharapkan.

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

### 2. DOKU Checkout — QRIS

Gunakan akun **merchant DOKU Business/Checkout**, bukan akun dompet konsumen. Aktifkan layanan QRIS pada akun merchant. Integrasi ini menggunakan **Checkout Non-SNAP**; kredensial private key SNAP tidak digunakan.

Di **Vercel → flash-sitasi → Settings → Environment Variables**, isi pada **Production**:

| Variabel | Isi |
| --- | --- |
| `APP_URL` | Origin aplikasi produksi, misalnya `https://flash-sitasi.vercel.app`, tanpa path/query; variabel yang sudah ada dapat tetap dipakai |
| `DOKU_CLIENT_ID` | Client ID merchant DOKU dari lingkungan production |
| `DOKU_SECRET_KEY` | Secret Key DOKU Checkout production; simpan sebagai Secret/Sensitive, tanpa prefix `VITE_` |
| `DOKU_ENVIRONMENT` | `production` untuk pembayaran nyata; default bila tidak diisi adalah `production` |
| `PAYMENT_PROVIDER` | Opsional: `doku`, yang juga merupakan default |

1. Ambil Client ID dan Secret Key dari dashboard merchant DOKU pada lingkungan yang sesuai.
2. Pastikan QRIS sudah disetujui dan aktif untuk DOKU Checkout merchant tersebut.
3. Atur **Notification URL** DOKU menjadi `https://flash-sitasi.vercel.app/api/doku-webhook`. Untuk domain lain, sesuaikan dengan `APP_URL`. Aplikasi juga mengirim `additional_info.override_notification_url` setiap membuat tagihan. Notifikasi harus dapat diakses tanpa login atau challenge browser.
4. Setelah menyimpan environment di Vercel, **redeploy** agar deployment menerima konfigurasi baru. Jangan mengirim Secret Key melalui chat, menaruhnya di frontend, atau memasukkannya ke GitHub.
5. Periksa `/api/payment-options`: `provider=doku`, metode QRIS, `availability.state=configured`. Ini hanya memeriksa konfigurasi aplikasi; selesaikan satu pengujian pembayaran untuk memverifikasi layanan merchant yang sebenarnya.

Untuk menguji sandbox, gunakan kredensial sandbox dan `DOKU_ENVIRONMENT=sandbox` pada deployment pengujian. Notifikasi sukses hanya mencatat `testPayment=true`, tanpa kredit atau badge. Gunakan Production untuk transaksi pengguna. Jika mengubah mode/Client ID, invoice yang dibuat dengan konfigurasi lama tidak dialihkan ke akun baru.

**Tagihan bayar.gg lama:** pertahankan `BAYAR_GG_API_KEY` dan `BAYAR_GG_WEBHOOK_SECRET` yang sudah terpasang, serta endpoint `/api/payment-webhook`. `BAYAR_GG_CHECKOUT_URL` tetap default `https://www.bayar.gg/pay` dan konfigurasi metode lama tetap hanya berlaku pada bayar.gg. Record lama tanpa `provider` dianggap berasal dari bayar.gg. Ini tidak membuat pembelian baru melalui bayar.gg ketika provider default DOKU digunakan.

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
2. Pilih 10 kredit, lalu buat tagihan. Nominal harus 10 × harga satuan aktif (Rp7.500 bila masih default); biaya/kode unik penyedia, jika ada, ditampilkan terpisah pada total tagihan. Untuk paket bernama, cocokkan dengan harga paket aktif.
3. Pastikan checkout DOKU terbuka pada QRIS dengan invoice dan nominal yang benar.
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

Pengujian paket kredit mencakup harga tiap paket yang berdiri sendiri, perubahan harga admin dan audit, nominal yang dimanipulasi browser, pembaruan harga sebelum checkout, percobaan ulang tagihan lama, pemilihan metode sesuai batas nominal, serta pengkreditan Sultan tepat 999 kredit sekali saja. Pengujian juga mempertahankan invoice lama Rp999.000 / 1.999 kredit.

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

Request pembayaran yang sudah dikirim tetapi berakhir timeout disimpan sebagai `paymentRequests.state=unknown` dan tidak otomatis dibuat ulang. Rekonsiliasi melalui dashboard merchant diperlukan bila invoice dibuat di penyedia tetapi respons tidak berhasil disimpan. Jangan menghapus penanda tersebut dan membuat invoice pengganti sebelum memastikan transaksi sebelumnya. Gunakan menu **Panel Admin → Rekonsiliasi** untuk menelusuri dan menghubungkan invoice yang sudah diverifikasi pada dashboard merchant. Nominal dan status diperiksa ulang ke penyedia asli tagihan sebelum tersimpan. Refund uang, pembatalan invoice pada penyedia, email transaksi, dan sengketa ditangani lewat layanan merchant; penyesuaian kredit admin tidak memindahkan uang.

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

- [DOKU Checkout: Backend Integration](https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration)
- [DOKU: Signature Non-SNAP](https://developers.doku.com/get-started-with-doku-api/signature-component/non-snap/signature-component-from-request-header)
- [DOKU: HTTP Notification Non-SNAP](https://developers.doku.com/get-started-with-doku-api/notification/http-notification-sample-non-snap)
- [DOKU: Check Status](https://developers.doku.com/get-started-with-doku-api/check-status-api/non-snap)
- [Dokumentasi resmi bayar.gg untuk invoice lama](https://www.bayar.gg/api-docs)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Firebase ID token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)

Dokumentasi DOKU diperiksa pada 26 Oktober 2026. Dokumentasi bayar.gg lama diperiksa pada 18 Oktober 2026. Ketentuan merchant dan akses metode dapat berubah; cek dashboard akun yang digunakan.

## Halaman publik dan SEO

Halaman `/`, `/tentang`, `/kebijakan-privasi`, dan `/syarat-ketentuan` dirender menjadi HTML saat build. Informasi publik bisa dibaca tanpa JavaScript; fitur akun dan sitasi tetap memakai React. `scripts/prerender.mjs` hanya mengompilasi komponen dalam memori dan tidak menjalankan server HTTP, migrasi, atau akses database. Saat prerender, SDK Firebase browser tidak diinisialisasi.

Build menghasilkan `robots.txt`, `sitemap.xml`, canonical per halaman, metadata Open Graph/Twitter, serta data terstruktur WebSite, WebApplication, WebPage, dan Person. Identitas pembuat: **Ricky Maulana**. Preview memakai `noindex, nofollow`; hanya produksi yang dibuka untuk pengindeksan. Tautan kebijakan tersedia di footer dan ruang kerja. Isi halaman ada di `shared/site-content.js`; kanal kontak diarahkan ke website resmi pembuat: https://rickymaulana.page.gd/.

Sitemap produksi: `https://flash-sitasi.vercel.app/sitemap.xml`. Pemilik dapat mengirim sitemap dan meminta pengindeksan URL melalui Google Search Console setelah memverifikasi kepemilikan situs. Menyiapkan SEO dan sitemap tidak menjamin kapan Google mengindeks atau menentukan peringkat.

## Template footnote

Template khusus menggunakan pola `Penulis (Tahun) “Judul.” Nama Jurnal. Kota, Vol. X No. Y, Bulan Tahun. hal. X-Y. DOI.` Nama jurnal dicetak miring pada footnote. Daftar pustaka menggunakan nama penulis pertama yang dibalik, judul di dalam tanda kutip, jurnal, penerbit, kota, volume, nomor, dan bulan/tahun. DOI dan halaman tetap tersedia di metadata/footnote; template daftar pustaka mengikuti contoh tanpa keduanya. Spasi setelah tanda koma diseragamkan.

Kapitalisasi judul dan nama mengikuti metadata atau input manual, termasuk teks campuran seperti `eDNA`. Bulan dibaca dari metadata publikasi Crossref/HTML atau pilihan manual; bulan yang tidak diketahui tidak ditebak. APA 7 tetap terpisah. Riwayat yang memiliki metadata dapat ditampilkan/disalin dengan template terbaru tanpa menulis ulang data atau memotong kredit; riwayat lama tanpa metadata tetap dapat dibaca.

### Badge akun dan profil publik

- Badge **Reguler / Pro / Plus / Sultan** terpisah dari role admin dan saldo kredit. Paket yang sudah lunas menaikkan badge otomatis ke paket tertinggi; top up satuan mengikuti tarif satuan dan mempertahankan badge.
- **Panel Admin → Pengguna → Lihat detail → Ubah badge** menyediakan semua level dan mode otomatis. Perubahan membutuhkan alasan, dicatat dalam audit, serta memeriksa versi profil agar tidak menimpa perubahan baru. Mode manual bertahan hingga dikembalikan ke otomatis.
- Paket lama yang sudah dikreditkan dibaca sekali pada login berikutnya untuk memulihkan badge; saldo dan status invoice dipertahankan.
- **Keanggotaan Saya** mengatur nama tampilan, bio, foto Google opsional, dan pilihan tampil publik. Publikasi tidak aktif secara default.
- Beranda menampilkan maksimal 48 profil yang memilih tampil, dengan Sultan diprioritaskan. Profil publik hanya berisi ID acak turunan, nama pilihan, bio, badge, dan foto yang disetujui. Email, UID Firebase, saldo, transaksi, serta riwayat tetap privat.
- Penggantian badge langsung memperbarui profil publik. Badge Reguler atau pemblokiran akun menyembunyikannya; penarikan persetujuan menghapus dokumen publik.
- Koleksi referensi, ekspor Word/PDF, dan benefit lanjutan belum termasuk rilis badge ini.

Pengaturan Sultan versi lama dibaca sebagai Rp500.000 / 999 kredit. Penyimpanan pengaturan melalui panel menandai revisi katalog; perubahan harga admin berikutnya tetap berlaku. Invoice yang sudah dibuat memakai snapshot lama dan tetap bisa dilanjutkan.

Build Vercel menjalankan `npm run check` (lint → test → build) sebelum deployment dinyatakan berhasil. Pengujian tidak menghubungi database produksi atau membuat pembayaran riil.

Halaman Sultan sebelum perubahan katalog harus dimuat ulang sebelum membuat invoice baru. Server memeriksa revisi katalog dan kuota yang dilihat pengguna; percobaan ulang invoice lama tetap memakai snapshot yang sudah tersimpan.

### Dialog anggota, benefit paket, dan kredit admin

Dialog bersama memakai portal ke `document.body` setelah hidrasi agar terlepas dari lapisan konten beranda. Token warna dan font ikut tersedia di backdrop; fokus keyboard, Escape, pengembalian fokus, dan penguncian scroll tetap aktif. Dialog anggota dibatasi lebar serta tinggi layar dan dapat digulir pada ponsel.

Kartu harga dan checkout menampilkan benefit badge/bingkai/profil publik yang sudah tersedia. Profil publik tetap memerlukan persetujuan. Checkout menjelaskan bila badge sedang dikunci manual oleh admin.

Admin aktif memiliki akses sitasi tanpa batas. Antarmuka menampilkan simbol ∞ bergradasi dengan animasi halus yang berhenti pada pengaturan pengurangan gerak. Server memeriksa role terbaru kembali dalam transaksi: sitasi admin mencatat `creditsSpent: 0` dan mutasi 0; saldo tersimpan tidak diubah. Role yang dicabut segera kembali memakai saldo biasa. Badge Sultan tidak memberi akses admin. Tidak ada nilai Infinity yang disimpan atau dikirim sebagai saldo.


### Pengambilan metadata Web/PDF

Mode Link Web/PDF mendukung tag sitasi jurnal (Highwire/Dublin Core/PRISM), JSON-LD Article/ScholarlyArticle beserta graph penulis/penerbit/jurnal, dan byline/heading semantik. Tautan OJS download/viewFile/galley dicoba melalui halaman artikel; viewer dapat meneruskan ke PDF publik terkait. Bila DOI di path gagal, metadata halaman tetap dicoba. Crossref dilengkapi fallback DataCite untuk DOI repositori; metadata dengan judul berbeda tidak menggantikan artikel yang diminta.

PDF langsung dibaca memakai serverless PDF.js melalui unpdf. Pembacaan mengambil metadata file, teks berposisi pada maksimal tiga halaman awal, dan DOI sebelum daftar referensi; hasil dicocokkan dengan judul sumber. Tanggal pembuatan/modifikasi file dan jumlah halaman PDF tidak dianggap sebagai tanggal publikasi atau rentang halaman artikel. Kapitalisasi judul/nama dipertahankan.

Batas sumber: HTML 2 MB, PDF 10 MB, maksimal tiga sumber per resolusi, empat redirect per sumber, dan batas waktu gabungan. Gzip/Brotli/deflate serta charset HTML lama didukung. HTTP yang ditempel dicoba sebagai HTTPS; sumber yang hanya menyediakan HTTP belum didukung. PDF pindai tanpa teks/metadata cukup, PDF bersandi/rusak, login, paywall dan CAPTCHA tetap dapat memerlukan DOI atau input manual. Situs tidak menjalankan OCR dan tidak melewati kontrol akses penerbit.

Seluruh koneksi sumber dan redirect memakai validasi IP publik serta DNS pinning ke soket. Tautan PDF/iframe tidak memberi akses ke jaringan privat. Buffer terkompresi maupun hasil dekompresi dibatasi. Parser hanya menerima byte yang sudah diunduh lewat jalur aman, tanpa mengambil URL atau mengeksekusi JavaScript di PDF.

Hanya metadata publik yang disimpan sementara dalam memori selama maksimal 60 detik (64 URL) untuk mengurangi pembacaan ulang pada pratinjau kota dan generate; byte PDF tidak disimpan. Hasil yang belum lengkap diberi catatan. Sumber yang tidak memiliki metadata layak gagal sebelum transaksi kredit, sehingga tidak membuat riwayat/mutasi atau memotong saldo. Permintaan ulang yang sama tetap idempoten.

Deployment memasang dependensi dari lockfile dengan npm ci, lalu menjalankan npm run check. Uji meliputi PDF riil yang dibuat dari fixture kecil, metadata JSON-LD/OJS/DataCite, sumber rusak/pindai, pencocokan DOI, DNS/redirect privat, dekompresi berbatas, dan transaksi kredit. Pengujian tidak menulis database produksi atau membuat pembayaran.

### Status metode pembayaran bayar.gg lama

Untuk provider bayar.gg lama, pengaturan top up aplikasi dan ketersediaan metode di bayar.gg merupakan pemeriksaan terpisah. API `/api/payment-options` menyertakan status umum `available`, `provider_unavailable`, atau `method_restricted`, tanpa mengirim data akun penyedia. Daftar metode kosong tidak lagi dianggap sebagai bukti bahwa pengelola lupa mengaktifkan pembayaran.

Harga paket dan harga satuan tetap tampil. Pembelian satuan maupun paket dinonaktifkan bila tidak ada metode yang mendukung nominal; pengguna dapat mengecek ulang. Status yang belum tersedia diperiksa kembali setiap 30 detik saat halaman terlihat, serta saat kembali online atau fokus.

Respons tanpa metode aktif disimpan maksimal 15 detik agar pemulihan penyedia cepat terbaca; status sehat disimpan 60 detik. Diagnostik server hanya mencatat ID metode beserta flag enabled/available yang sudah disaring. Kunci API, status akun, detail persyaratan, dan payload penyedia tidak dicatat. Pembatas metode yang dikonfigurasi tetap dihormati; sistem tidak memaksa kanal nonaktif atau membuat invoice saat metode belum tersedia.

### Pengujian migrasi DOKU

Pengujian lokal mencakup kontrak signature POST/GET Non-SNAP, QRIS-only, harga admin, tiga paket, pembatasan URL checkout, respons palsu, timeout/409, byte body notifikasi, nominal/channel salah, callback berulang, polling pemulihan, pembayaran sandbox tanpa kredit, invoice bayar.gg lama, dan rekonsiliasi admin. Pengujian memakai respons fixture berdasarkan dokumentasi resmi; ini bukan bukti bahwa akun merchant DOKU produksi sudah aktif. Uji layanan nyata dilakukan setelah kredensial dan QRIS merchant terpasang.
