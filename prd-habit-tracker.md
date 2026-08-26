# PRD — Habit Tracker berbasis Atomic Habits

**Nama produk:** TBD
**Status:** Final v2.0 — siap masuk fase build
**Konteks pengembangan:** Solo developer, vibe-coding dengan Claude Code (Opus 5)
**Skala awal:** Personal use (single user), dirancang agar bisa dibuka ke publik tanpa rombak arsitektur
**Terakhir diperbarui:** 23 Agustus 2026

---

## 1. Ringkasan

Habit tracker mobile yang menerapkan prinsip *Atomic Habits* di level UX, dengan empat pembeda utama:

1. **Petakan rutinitas yang sudah ada dulu, baru sisipkan kebiasaan baru** — AI mencari celah waktu realistis lewat negosiasi, bukan pengguna asal menempel jadwal.
2. **Validasi kejelasan input lewat AI** — tidak ada niat kabur seperti "olahraga" tanpa hari/jam/lokasi.
3. **Reward finansial yang dijalankan manual** — aplikasi hanya mengingatkan, tidak pernah menyentuh rekening.
4. **Tracker yang tahu kapan harus berhenti** — begitu kebiasaan sudah otomatis, ia "lulus" dan berhenti dilacak harian, supaya tidak jadi beban administratif.

**Prinsip UX yang mengikat seluruh dokumen ini:** aplikasi harus terasa ringan dipakai. Interaksi harian maksimal satu tap. Setiap layar hanya meminta satu hal. Kalau sebuah fitur butuh penjelasan panjang supaya pengguna paham, fitur itu terlalu rumit dan harus disederhanakan — bukan dijelaskan lebih panjang.

## 2. Masalah yang diserang

| Masalah | Solusi |
|---|---|
| Rencana tidak realistis terhadap rutinitas yang sudah ada | Pemetaan rutinitas existing + AI habit stacking dengan negosiasi (§4.1, §4.3) |
| Siklus all-or-nothing: satu kali gagal → berhenti total | Prinsip "never miss twice", recovery bonus, tanpa mekanisme shaming (§4.7) |
| Tracker tidak tahu kapan harus berhenti → beban administratif | Siklus hidup habit: building → mastered, dengan 3 gate (§4.8) |
| Rutinitas kecil bikin notifikasi jadi spam | Habit dikelompokkan; satu grup = satu reminder = satu log (§4.2) |

## 3. Prinsip desain

| Hukum Atomic Habits | Penerapan |
|---|---|
| Make it obvious | Implementation intention wajib (hari, jam, lokasi); heatmap streak |
| Make it attractive | Identity tagging + poin identitas |
| Make it easy | AI habit stacking ke celah rutinitas existing; grup sebagai satu unit |
| Make it satisfying | Poin identitas + alokasi dana ke rekening keinginan |
| Never miss twice | Konsekuensi difokuskan ke pemulihan cepat, bukan hukuman |
| Identitas > hasil | Tracker adalah alat sementara — kebiasaan yang sudah otomatis dilepaskan, bukan dipaksa terus dicatat |

**Non-goals (MVP):** tidak ada integrasi API bank/e-wallet; tidak ada diagnosis psikologis atau label kepribadian final; tidak ada habit kolaboratif (keluarga/tim); tidak ada habit negatif dan habit event-based di v1 (lihat §10).

---

## 4. Spesifikasi fitur

Prioritas: **P0** = wajib MVP · **P1** = penting, boleh menyusul · **P2** = nice to have.

### 4.1 Onboarding — pemetaan rutinitas existing · P0

Wajib diselesaikan sekali sebelum pengguna bisa mengakses fitur lain. Target durasi: **di bawah 5 menit**.

**Yang dilihat pengguna:** beberapa layar berurutan, satu blok waktu per layar, isi dengan tap.

- **Microcopy alasan wajib muncul sebelum pertanyaan pertama** (bukan cuma di layar judul), contoh: *"Biar kami tahu harimu seperti apa, dan bisa menaruh kebiasaan baru di waktu yang pas."*
- Pertanyaan dipecah **per blok waktu besar** (bangun–jam 9, jam 9–12, siang–sore, sore–malam, sebelum tidur) — bukan per jam, bukan kolom teks bebas.
- Tiap blok: **chip pilihan cepat** (kerja, antar anak, ibadah, olahraga, masak, dll) + opsi "lainnya" untuk teks manual + tombol **"lewati"** untuk blok kosong.
- Progress indicator wajib ada, supaya proses terasa terbatas.
- Output tersimpan sebagai daftar `RoutineBlock`, bisa diedit kapan saja dari halaman pengaturan.

### 4.2 Habit & grup — struktur dasar · P0

**Konsep tunggal: semua habit hidup di dalam sebuah grup.** Habit besar yang berdiri sendiri = grup berisi satu langkah. Rutinitas pagi = grup berisi beberapa langkah. Tidak ada tipe data terpisah untuk "habit besar" dan "habit kecil".

**Grup adalah satu-satunya unit yang dilacak:**

| Aspek | Berlaku di level |
|---|---|
| Jadwal (hari, jam mulai, jam selesai) | Grup |
| Reminder | Grup — satu notifikasi, bukan per langkah |
| Tanda selesai harian | Grup — satu tap |
| Poin identitas | Grup — satu vote per hari |
| Status building/mastered | Grup |

**Kenapa poin dihitung per grup, bukan per langkah:** kalau per langkah, rutinitas bisa dipecah jadi banyak langkah kecil untuk mengejar poin, dan gate `mastered` (§4.8) jadi mudah ditembus tanpa perubahan nyata.

**Menambah habit — yang dilihat pengguna:**

1. Isi nama kebiasaan, kapan (hari + jam), dan di mana.
2. Opsional: *"kebiasaan ini membantuku menjadi orang ___"* (identity tag).
3. AI cek kejelasan (§4.2.1), lalu AI usulkan waktunya (§4.3).
4. Setelah tersimpan, muncul satu tawaran: **"Mau tambah kebiasaan lain setelah ini?"** Kalau ya, habit berikutnya masuk ke grup yang sama, tepat setelah langkah sebelumnya. Kalau tidak, selesai.

Grup yang berisi lebih dari satu langkah otomatis diminta diberi nama (mis. "Morning Routine"), dengan nama default yang sudah terisi supaya pengguna cukup menekan lanjut.

#### 4.2.1 AI ambiguity check

Berjalan otomatis saat submit, sebelum data disimpan:

- Nama habit harus actionable, bukan tujuan abstrak ("jadi lebih sehat" → minta dipertajam).
- Lokasi harus cukup spesifik ("di rumah" boleh, disarankan dipertajam jadi "di kamar" bila relevan).
- Rentang jam masuk akal (durasi bukan 0 menit, tidak melewati tengah malam tanpa disengaja).
- Jika ambigu → AI **bertanya satu pertanyaan singkat**, bukan menolak. Pengguna tetap bisa lanjut menyimpan setelah satu putaran konfirmasi.

### 4.3 AI habit stacking + negotiation loop · P0

**Yang dilihat pengguna:** satu usulan waktu, dua tombol — *"Oke"* atau *"Ganti"*.

- **Input:** seluruh `RoutineBlock` + detail grup baru.
- **Output:** satu usulan slot + alasan singkat 1–2 kalimat (mis. *"Setelah kamu mengantar anak sekolah, sekitar jam 7.30 — biasanya kamu senggang di situ."*).
- Kalau ditolak, pengguna mengetik alasan singkat (mis. "anak-anakku berisik jam segitu"). AI menyusun ulang dengan mempertimbangkan **seluruh riwayat penolakan di sesi itu** — usulan berikutnya tidak boleh mirip dengan yang sudah ditolak.
- **Batas maksimal 3 putaran.** Setelah itu langsung tawarkan pilih jam sendiri, supaya pengguna tidak terjebak berdebat dengan AI.
- Untuk grup berisi beberapa langkah, AI hanya mencari **satu slot untuk seluruh grup**, bukan satu slot per langkah.

### 4.4 Tracking harian · P0

**Yang dilihat pengguna:** daftar grup hari ini. Satu tap untuk menandai selesai. Tidak ada langkah lain.

- Grup berstatus `mastered` (§4.8) tidak muncul di sini.
- Untuk grup berisi beberapa langkah, cukup satu tap untuk seluruh grup. Rincian langkah bisa dibuka kalau pengguna mau, tapi tidak wajib disentuh.
- Wajib berfungsi **offline**, sinkron saat online kembali.
- **Grace period:** status suatu hari masih bisa diubah sampai **pukul 03:00 dini hari berikutnya** — mengakomodasi lupa mencatat sebelum tidur. Setelah itu terkunci, demi integritas streak dan mencegah manipulasi retroaktif.
- Kalau tidak selesai sampai jam target → status "terlewat", dengan pesan berorientasi pemulihan (§4.7), bukan hukuman.

### 4.5 Notifikasi & reminder · P0 (smart timing: P1)

- Satu notifikasi per grup, dikirim mendekati jam mulai. Contoh: *"Morning routine?"* — pendek, bisa langsung ditandai selesai dari notifikasi tanpa membuka aplikasi.
- **Smart timing (P1):** sistem mempelajari kapan pengguna paling sering melewatkan grup tertentu, lalu mengirim reminder lebih awal di waktu rawan itu.
- Bisa diatur ulang atau dimatikan per grup.
- Grup `mastered` tidak lagi mengirim notifikasi harian — hanya check-in berkala (§4.8).

### 4.6 Poin identitas · P0

Reward utama **bukan** badge atau poin generik, tapi terikat ke identity tag yang dideklarasikan pengguna — sejalan dengan prinsip bahwa setiap kebiasaan adalah 'vote' untuk identitas yang ingin dibentuk.

- Setiap identity tag punya penghitung sendiri, mulai dari **0**, bertambah **+1** setiap grup terkait ditandai selesai.
- Poin ini **murni reinforcement psikologis** — terpisah dari sistem finance (§4.7), bukan mata uang, tidak bisa ditukar apa pun.
- Grup tanpa identity tag tetap bisa ditandai selesai, hanya tidak menambah poin — dorongan halus supaya pengguna mengisinya.
- Grup yang menjadi `mastered` **tetap menyimpan poin yang sudah terkumpul**, hanya berhenti menambah poin baru.

### 4.7 Reward & finance (manual, opt-in) · P1

**Prinsip mutlak:** aplikasi tidak pernah melakukan transaksi apa pun. Aplikasi hanya mengingatkan; pengguna melakukan sendiri di aplikasi bank masing-masing.

- **Layar edukasi wajib** saat pertama kali mengaktifkan fitur ini — menegaskan aplikasi tidak terhubung ke rekening manapun dan semua pencatatan manual. Mencegah ekspektasi yang salah sejak awal.
- Pengguna menentukan di awal bulan: total jatah "uang keinginan" (mis. 30% dari pemasukan) dan increment per penyelesaian (mis. 1%).
- Grup selesai → prompt singkat: *"Alokasikan 1% ke rekening keinginan? (X% dari Y% terpakai bulan ini)"* dengan tombol **"Sudah"** atau **"Nanti"**. Prompt tidak akan mendorong melebihi jatah yang ditentukan sendiri.

**Saat tidak diselesaikan — pemulihan, bukan hukuman:**

- Alokasi bulan itu **tidak bertambah**, bukan dikurangi ke minus — prinsip "jeda pertumbuhan".
- Pesan fokus ke aksi berikutnya: *"Nggak apa-apa. Yang penting jangan dua hari berturut-turut."*
- Gagal 2 hari berturut-turut → alokasi ditahan sampai berhasil lagi. Tetap tanpa saldo negatif.
- **Recovery bonus:** berhasil lagi tepat sehari setelah gagal → reward tambahan kecil.

> **Catatan keputusan:** ide awal berupa hukuman yang membuat pengguna malu dan mendorong saldo minus **sengaja tidak diterapkan**. Mekanisme berbasis shame berisiko memicu shame-spiral yang justru membangun ulang siklus all-or-nothing yang ingin dihindari produk ini — ditambah risiko stres finansial nyata.

### 4.8 Siklus hidup: building → mastered · P1

**Prinsip:** tracker adalah alat bantu sementara. Begitu kebiasaan benar-benar otomatis, memaksa pencatatan harian jadi kontraproduktif — tapi status ini tidak boleh dipicu euforia beberapa hari pertama. Karena itu transisinya pakai **tiga gate**, bukan satu ambang durasi.

**Dua status:**

- **`building`** — masih dibentuk, wajib ditandai harian, masih dihitung AI merge engine. Inilah **skema sementara** pengguna.
- **`mastered`** — dianggap otomatis. Berhenti tampil di tracking harian dan notifikasi; datanya **dilipat ke `RoutineBlock`** sebagai bagian rutinitas tetap — inilah **skema permanen** pengguna, sekaligus jadi konteks untuk penempatan kebiasaan baru berikutnya. Riwayat (heatmap, poin) tetap tersimpan.

**Tiga gate — semua harus terpenuhi:**

| Gate | Ambang default | Alasan |
|---|---|---|
| Poin identitas | ≥ 40 poin pada identity tag terkait | Menandakan investasi cukup pada identitas itu |
| Konsistensi | Completion rate ≥ 80% dalam 30 hari terakhir | Pakai *rate*, bukan streak — satu hari kelewat tidak mereset ke nol |
| Waktu minimum | ≥ 21 hari sejak grup dibuat | Mencegah "selesai" dari semangat 5 hari pertama |

**Alur — yang dilihat pengguna:**

1. Evaluasi gate berjalan harian di belakang layar. **Deterministik, tanpa LLM.**
2. Gate terpenuhi → aplikasi **menawarkan**, bukan menyediakan tombol yang selalu aktif: *"'[nama grup]' kayaknya udah otomatis buat kamu. Berhenti dilacak harian?"* dengan tombol **"Ya"** / **"Belum"**.
3. Kalau "Belum", tawaran muncul lagi di evaluasi berikutnya — tidak diulang setiap hari.
4. **Selesai manual sebelum gate terpenuhi:** boleh, tidak diblokir, tapi diberi satu friksi reflektif — *"Baru jalan 5 hari. Biasanya butuh lebih lama buat jadi otomatis. Yakin?"* Kalau tetap insisten, hormati keputusannya.

**Safety net:**

- Setelah `mastered`, check-in ringan setiap **2–4 minggu**: *"'[nama grup]' masih jalan?"*
- Kalau mulai kendor (atau pengguna menekan "aktifkan lagi" kapan pun dari halaman detail), status kembali ke `building` — **tanpa framing gagal atau malu**, cukup "lanjut dari sini".
- Progres gate untuk siklus baru **dihitung ulang dari titik reaktivasi**, tidak mewarisi riwayat lama, supaya evaluasinya tetap valid.

**Soft cap 3 grup aktif:** ketika sudah ada 3 grup `building` bersamaan, tampilkan nudge sebelum menambah yang ke-4 (*"Kamu lagi bangun 3 kebiasaan sekaligus. Fokus ke sedikit biasanya lebih berhasil — tetap lanjut?"*). **Nudge, bukan hard block.** Grup `mastered` tidak dihitung.

### 4.9 Halaman identitas · P1

Layar yang menerjemahkan data menjadi arti — menjawab *"jadi aku ini siapa sekarang?"*

- **Skema permanen:** daftar kebiasaan yang sudah `mastered`, ditampilkan sebagai bagian tetap dari hari pengguna.
- **Skema sementara:** grup yang masih `building`, dengan progres menuju tiga gate.
- **Identitas yang terpegang:** tiap identity tag beserta poinnya, ditulis sebagai kalimat, bukan angka telanjang. Contoh: *"Kamu sudah 40 kali memilih jadi orang yang disiplin. Dua kebiasaan sudah jadi bagian tetap dari harimu."*

Ini layar baca saja — tidak ada form, tidak ada aksi wajib.

### 4.10 Visual streak / heatmap · P0

- Heatmap ala GitHub contribution graph, per grup dan gabungan.
- Menampilkan streak berjalan, streak terpanjang, konsistensi bulanan.
- Grup `mastered` tetap tampil sebagai riwayat read-only dengan penanda berbeda (mis. "mastered sejak [tanggal]"), supaya jejak perjalanannya terlihat.

### 4.11 Identity reflection dari rutinitas · P2

- Setelah onboarding, AI **boleh** menawarkan satu observasi: *"Sepertinya kamu memprioritaskan waktu pagi untuk diri sendiri — betul?"*
- **Wajib tentatif dan bisa dikonfirmasi/diedit/ditolak** — tidak pernah label final. Data rutinitas terlalu terbatas untuk menyimpulkan kepribadian (orang bangun jam 5 bisa karena macet, bukan karena disiplin), dan tebakan yang meleset merusak trust ke seluruh fitur AI.
- Opsional dan non-blocking — boleh di-skip sepenuhnya.
- Identity yang dikonfirmasi masuk sistem poin (§4.6) mulai dari 0, dan jadi pilihan cepat di form berikutnya.

---

## 5. Data model

| Entity | Field kunci |
|---|---|
| `User` | id, nama, preferensi notifikasi |
| `RoutineBlock` | user_id, label, jam_mulai, jam_selesai, sumber (onboarding / hasil grup mastered) |
| `HabitGroup` | user_id, nama, frekuensi, hari[], jam_mulai, jam_selesai, lokasi, identity_tag_id, status (building/mastered), tanggal_dibuat, tanggal_mastered (nullable), tanggal_reaktivasi_terakhir (nullable) |
| `Habit` | group_id, nama, urutan, `trigger_type` (v1: selalu `time_based`) |
| `HabitLog` | group_id, tanggal, status (selesai/terlewat) |
| `HabitLifecycleEvent` | group_id, tipe (mastered/reactivated), tanggal, catatan (opsional) |
| `NegotiationSession` | group_id, riwayat usulan, riwayat alasan penolakan, status akhir |
| `IdentityTag` | user_id, label, sumber (konfirmasi rutinitas / manual), poin (mulai dari 0) |
| `FinanceAllocationSetting` | user_id, bulan, jatah_persen_total, increment_per_habit |
| `FinanceAllocationLog` | user_id, tanggal, persen_dialokasikan |

**Catatan penting:**

- `HabitLog` terikat ke **`group_id`, bukan `habit_id`** — konsekuensi langsung dari keputusan bahwa grup adalah unit pelacakan (§4.2).
- Field `trigger_type` di `Habit` sengaja disiapkan sejak v1 meski nilainya selalu `time_based`, supaya habit event-based (§10) bisa ditambahkan tanpa migrasi skema.
- Setiap tabel wajib punya `user_id` dan Row-Level Security aktif sejak awal — lihat §8.

---

## 6. Tech stack

Pilihan condong ke opsi minim boilerplate dan enak dikerjakan iteratif lintas sesi AI-assisted, bukan semata soal skala.

### 6.1 Frontend (mobile)

| Komponen | Pilihan | Alasan |
|---|---|---|
| Framework | **Expo (React Native) + TypeScript** | Iterasi cepat (OTA update, managed native modules); TypeScript memberi konteks tipe yang jelas untuk Claude Code lintas sesi |
| Package manager | **pnpm** | Ringan (content-addressable storage + symlink), install cepat — terasa di dependency tree Expo yang besar |
| Database lokal | **SQLite** via `expo-sqlite` + Drizzle ORM | Cukup untuk offline-first tanpa kompleksitas sync-engine seperti WatermelonDB |
| Notifikasi | **Expo Notifications** | Terintegrasi langsung, tanpa setup native FCM/APNs manual |

### 6.2 Backend — Supabase-native, tanpa server custom

**Keputusan: tidak ada backend Express/NestJS terpisah.** Supabase menyediakan REST API otomatis dari skema tabel, dijaga Row-Level Security — jadi seluruh CRUD (§5) dipanggil langsung dari client Expo tanpa satu baris pun kode backend.

| Komponen | Pilihan | Alasan |
|---|---|---|
| Database | **Supabase Postgres** | Data model relasional §5; auto-generated API + RLS memangkas boilerplate CRUD |
| Auth | **Supabase Auth** | Multi-user by default sejak hari pertama; menangani token/session otomatis |
| Server-side logic | **Supabase Edge Functions** (Deno + TypeScript) | Hanya untuk yang wajib di server: panggilan LLM (§6.4). Deploy via CLI, tanpa server yang di-maintain |

**Kenapa Edge Functions, bukan server sendiri:** satu-satunya alasan butuh server adalah menyembunyikan API key LLM — key tidak boleh ada di app karena bisa diekstrak dari binary. Untuk tiga endpoint LLM, Express + Docker + hosting terpisah adalah overkill.

**Ditinjau ulang bila:** muncul kebutuhan cron job kompleks, integrasi pihak ketiga yang berat, atau logika bisnis yang tidak nyaman ditulis sebagai edge function.

### 6.3 Struktur repository — monorepo

```
habit-tracker/
├── app/                    # Expo React Native + TypeScript
├── supabase/
│   ├── migrations/         # skema DB + RLS policies
│   └── functions/          # edge functions (panggilan LLM)
├── shared/                 # TypeScript types dipakai kedua sisi
└── package.json            # pnpm workspace
```

**Alasan:** development solo dengan Claude Code. Repo terpisah berarti setiap perubahan bentuk data harus dijelaskan ulang di dua sesi berbeda, dan tipe di client gampang out-of-sync dengan skema database tanpa ketahuan sampai runtime. Monorepo + folder `shared/` membuat Claude Code melihat kedua sisi sekaligus, dan TypeScript menangkap mismatch saat compile.

Repo terpisah baru masuk akal kalau ada tim berbeda per sisi, atau backend dikonsumsi banyak client — keduanya tidak berlaku.

### 6.4 Integrasi AI/LLM

Tiga fitur butuh LLM: **ambiguity check** (§4.2.1), **schedule merge engine** (§4.3), **identity reflection** (§4.11). Ketiganya berjalan di Edge Functions, tidak pernah dipanggil langsung dari client. Gate evaluator (§4.8) **tidak** butuh LLM — deterministik, cukup cek angka.

- **Provider: Claude API.** Model kelas ringan untuk ambiguity check & identity reflection (latensi rendah); model kelas menengah untuk schedule merge engine (butuh reasoning atas seluruh rutinitas). Karena development sudah pakai Claude Code, konsistensi ekosistem mengurangi kompleksitas integrasi.
- **Structured output (JSON) wajib** — hasil dipetakan langsung ke UI, bukan diparsing dari teks bebas.
- **Schedule merge engine wajib menerima riwayat penolakan lengkap** di setiap putaran, bukan hanya penolakan terakhir.
- **Caching & rate-limiting wajib** — ambiguity check dan negotiation loop berpotensi terpanggil berkali-kali dalam satu sesi.
- **Instrumentasi token usage sejak hari pertama** supaya biaya per pengguna bisa dihitung dari data nyata.

### 6.5 Infrastruktur

- **Hosting:** tidak ada server sendiri. Database, auth, dan edge functions di Supabase; distribusi app lewat Expo (EAS Build + OTA update).
- **Secret management:** API key LLM sebagai environment secret di Edge Functions — tidak pernah masuk bundle aplikasi maupun repo.
- **Analytics:** Amplitude atau Mixpanel (tier gratis cukup di tahap awal).
- **Keamanan:** TLS untuk semua komunikasi, enkripsi at-rest di level database, token sensitif di Keychain (iOS) / Keystore (Android).

---

## 7. Sinyal yang dipantau

Tahap awal adalah personal use, jadi ini bukan KPI bisnis — melainkan sinyal untuk memvalidasi asumsi yang masih ditandai tentatif di §11.

| Sinyal | Memvalidasi |
|---|---|
| Rata-rata putaran negosiasi sebelum jadwal disetujui | Akurasi AI merge engine (§4.3). Konsisten 3 putaran = prompt perlu diperbaiki |
| Persentase pemulihan dalam 1–2 hari setelah miss | Efektivitas "never miss twice" (§4.7) |
| Grup yang mencapai `mastered` dan bertahan tanpa reaktivasi dalam 60 hari | Ketepatan ambang tiga gate (§4.8). Banyak reaktivasi = ambang terlalu longgar |
| Rata-rata jumlah langkah per grup | Apakah pengelompokan (§4.2) benar-benar dipakai, atau semua grup berisi satu langkah |
| Tingkat pengisian identity tag | Apakah dorongan halus di §4.6 cukup, atau perlu diwajibkan |
| Token usage per sesi onboarding | Kelayakan biaya bila dibuka ke publik (§8) |

---

## 8. Kesiapan distribusi publik

Rencana saat ini personal use, dengan kemungkinan dibuka ke publik. Stack yang dipilih sudah multi-user by default, jadi **tidak perlu develop dua kali** — cukup jaga empat hal sejak awal:

1. **Aktifkan Row-Level Security sejak hari pertama**, walau baru satu pengguna. Ini satu-satunya item yang benar-benar menyusahkan kalau di-retrofit belakangan.
2. **Jangan hardcode data pribadi.** Tidak ada identity tag atau routine block pribadi sebagai seed default.
3. **Semua tabel wajib punya `user_id`, semua query di-scope ke pengguna aktif** — tidak ada query global sekalipun sedang single-user.
4. **Model biaya LLM ditandai sebagai keputusan tertunda.** Subscription, freemium, atau BYOK? Data token usage dari §7 adalah input utamanya.

**Sengaja belum dipikirkan** (dan tidak boleh jadi bahan over-engineering di MVP): app store listing, pricing, terms of service, skalabilitas server.

**Follow-up sebelum rilis publik:** kebijakan privasi & retensi wajib direview terhadap UU PDP Indonesia; fitur finance (§4.7) kemungkinan butuh disclaimer tambahan karena situasi finansial pengguna lain berbeda-beda.

---

## 9. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Onboarding terlalu panjang → drop-off | Blok waktu besar, chip pilihan cepat, tombol lewati, progress indicator, microcopy alasan (§4.1) |
| Loop negosiasi tanpa akhir → frustrasi | Batas 3 putaran, lalu pilih jam sendiri (§4.3) |
| Notifikasi terlalu sering → aplikasi dimatikan notifnya | Satu reminder per grup, bukan per langkah (§4.2, §4.5) |
| Hukuman finansial berbasis shame memicu shame-spiral & stres finansial nyata | Diganti "jeda pertumbuhan" + "never miss twice" + recovery bonus (§4.7) |
| Status `mastered` dipicu terlalu cepat oleh euforia awal | Tiga gate, friksi reflektif, check-in berkala + reaktivasi tanpa shame (§4.8) |
| Kesimpulan identitas AI meleset → trust turun ke seluruh fitur AI | Selalu tentatif, bisa dikonfirmasi/diedit, opsional, non-blocking (§4.11) |
| Biaya & latensi panggilan AI berulang | Gate evaluator tanpa LLM; caching, rate-limiting, instrumentasi token (§6.4) |
| Data rutinitas + finansial sensitif | Enkripsi at-rest, RLS, consent eksplisit, hanya simpan persentase — bukan nominal atau data rekening |
| **Scope creep menghentikan proyek sebelum selesai** | Habit negatif & event-based ditunda ke v2 (§10); soft cap fitur sama seperti soft cap habit — fokus ke sedikit dulu |
| Solo developer = satu titik kegagalan | Maksimalkan layanan terkelola (Supabase); PRD ini jadi dokumen konteks lintas sesi vibe-coding |

---

## 10. Ditunda ke v2 — desain sudah matang, tinggal dibangun

Dua fitur di bawah **sengaja tidak masuk v1**. Alasannya bukan karena idenya lemah, tapi karena masing-masing merombak beberapa spec sekaligus, dan menunda titik di mana aplikasi bisa benar-benar dipakai. Keduanya bisa ditambahkan **tanpa rombak arsitektur**, asal field `trigger_type` (§5) sudah ada sejak v1.

### 10.1 Habit event-based

Untuk kebiasaan yang cue-nya kejadian, bukan jam — mis. *"setiap kali ada pemasukan, bagi ke rekening kebutuhan/keinginan/jangka panjang."* Ini justru bentuk asli habit stacking di bukunya: *"After [CURRENT HABIT], I will [NEW HABIT]"* — cue-nya kejadian, bukan waktu.

Implementasi: `trigger_type = event_based`, dengan entry point terpisah berupa tombol "lapor kejadian".

**Yang berubah kalau ini masuk:**

| Spec | Perubahan |
|---|---|
| Tracking harian (§4.4) | Tidak muncul tiap hari; muncul saat pengguna melapor |
| Gate konsistensi (§4.8) | Bukan rate atas hari kalender, tapi **rate atas kemunculan trigger** (mis. 8 dari 10 kali terakhir) |
| Gate waktu (§4.8) | Bukan 21 hari, tapi **jumlah trigger minimum** (mis. 5 kali) — habit bulanan tidak akan pernah lolos 21 hari |
| Notifikasi (§4.5) | Tidak bisa berbasis jam; paling jauh check-in lembut berkala |
| Heatmap (§4.10) | Grid kalender tidak masuk akal; butuh tampilan daftar kejadian |

**Catatan:** ini terpisah dari fitur finance §4.7. Yang di sini adalah *kebiasaan* mengalokasikan income; §4.7 adalah *reward* atas kebiasaan lain. Jangan digabung — beda tujuan, dan menggabungkannya membingungkan.

### 10.2 Habit negatif (menghilangkan kebiasaan)

**Alur yang direncanakan:** setelah pengguna mengisi rutinitas existing, ada opsi ketiga selain "kebiasaan yang ingin ditambah", yaitu **"kebiasaan yang ingin dihilangkan"** beserta *kapan dan di mana biasanya terjadi*.

**Empat keputusan desain yang sudah diambil, supaya tidak perlu dipikirkan ulang nanti:**

1. **Pakai inversi 4 hukum, bukan sekadar tracking.** Buku ini punya framework terpisah untuk menghapus kebiasaan: make it *invisible / unattractive / difficult / unsatisfying*. Yang paling berdampak adalah hukum pertama. Karena itu data "kapan & di mana biasanya terjadi" **jangan hanya dipakai untuk reminder**, tapi untuk saran mengubah lingkungan — mis. *"Kamu bilang biasanya jam 11 malam di kamar sambil pegang HP. Gimana kalau HP-nya dicas di ruang lain mulai jam 10?"* Itu jauh lebih efektif daripada notifikasi bertanya "sudah belum?".

2. **Identitas tetap positif.** Jangan pernah membuat identitas negatif. Habit negatif memakai `IdentityTag` yang sama, diisi identitas tujuannya — mis. *"orang yang bisa mengendalikan impulsnya"* — dan tiap hari berhasil menambah +1 seperti biasa. Sistem yang membuat pengguna melabeli diri dengan identitas yang dibencinya justru memperkuat identitas itu.

3. **Diam ≠ gagal.** Tracking habit negatif asimetris: kalau pengguna tidak menandai apa pun, itu ambigu — bisa berhasil tapi lupa lapor, bisa juga relapse dan sedang menghindari aplikasinya. Menganggapnya berhasil = data palsu; menganggapnya gagal = menghukum orang yang sebenarnya berhasil. **Keputusan: status "tidak tercatat"** — bukan berhasil, bukan gagal. Streak hanya dihitung dari check-in positif; hari kosong tidak memutus streak, hanya tidak menambah.

4. **Simpan lokal saja.** Data ini jauh lebih sensitif daripada rutinitas biasa. Habit negatif disimpan di SQLite device, **tidak pernah sync ke server**. Trade-off: tidak bisa lintas device — dan itu sepadan, sekaligus jadi nilai jual.

**Catatan penempatan:** pertanyaan "kebiasaan apa yang ingin dihilangkan?" **jangan** ditaruh di onboarding awal. Pengguna yang baru menginstal 2 menit belum percaya pada aplikasinya dan kemungkinan besar akan skip atau menjawab yang aman. Cukup satu kalimat di onboarding yang memberi tahu fitur ini ada, lalu buat mudah ditemukan kapan saja.

### 10.3 Di luar cakupan sepenuhnya

- Integrasi langsung ke rekening bank/e-wallet.
- Habit kolaboratif (keluarga, tim).
- Analisis kesehatan mental lebih dalam dari pola habit.
- Marketplace reward pihak ketiga — kemungkinan arah monetisasi.
- Personalisasi ambang gate §4.8 per pengguna.

---

## 11. Log keputusan

Nilai bertanda **tentatif** adalah default awal yang sengaja ditetapkan agar build bisa jalan — bukan hasil riset, dan dirancang untuk direvisi setelah ada data dari §7.

| Keputusan | Nilai | Status |
|---|---|---|
| Unit pelacakan | Grup, bukan habit individual — satu jadwal, satu reminder, satu log, satu poin | Final |
| Habit "besar vs kecil" | Ditolak sebagai kategori — habit besar = grup berisi satu langkah | Final |
| Poin identitas | Per grup, bukan per langkah (mencegah gaming lewat pemecahan langkah) | Final |
| Grace period | Sampai 03:00 dini hari berikutnya | Final |
| Fitur finance | Manual sepenuhnya + layar edukasi wajib saat aktivasi | Final |
| Mekanisme hukuman finansial | Ditolak — diganti pendekatan pemulihan | Final |
| Gate `mastered` | 40 poin / rate 80% dalam 30 hari / minimal 21 hari | **Tentatif** |
| Interval check-in `mastered` | 2–4 minggu | **Tentatif** |
| Batas grup aktif | Soft cap 3 grup `building` | Final (nudge, bukan block) |
| Habit event-based & habit negatif | Ditunda ke v2, desain terdokumentasi di §10 | Final |
| Backend custom (Express/NestJS) | Ditolak — Supabase-native | Final, ditinjau bila muncul kebutuhan logika server berat |
| Struktur repo | Monorepo (app + supabase + shared), pnpm workspace | Final |
| Tech stack | Expo RN + TS, pnpm, SQLite lokal, Expo Notifications, Supabase (Auth + Postgres + Edge Functions) | Final |
| LLM provider | Claude API | Final untuk MVP, dievaluasi setelah ada data biaya |
| Retensi data | Hapus dari server 30 hari setelah akun dihapus; data lokal hilang saat uninstall | Final untuk personal use — **wajib direview sebelum rilis publik** |

**Tidak ada pertanyaan terbuka yang memblokir mulai fase build.**
