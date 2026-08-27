# Cara menjalankan

Dua mode. Development untuk ngoding, preview untuk memasang APK di HP.

---

## A. Development — ubah kode, HP langsung berubah

Sekali saja, di HP: pasang **Expo Go** (Play Store / App Store).

Setiap kali mau ngoding:

```bash
yarn dev
```

Lalu scan QR yang muncul pakai Expo Go.

Satu perintah itu sudah menyalakan Docker, Supabase, edge function AI, menulis `.env` dengan alamat Wi-Fi laptop, dan menjalankan Expo. Simpan file → HP refresh sendiri.

**Syarat:** HP dan laptop di Wi-Fi yang sama.

**Kalau HP tidak konek:** kamu pindah Wi-Fi, jadi alamat laptop berubah. Tutup (`Ctrl+C`), jalankan `yarn dev` lagi.

**Selesai ngoding:** `Ctrl+C`. Edge function ikut mati sendiri. Container Supabase tetap hidup — matikan dengan `supabase stop` kalau laptop mau diistirahatkan.

---

## B. Preview — APK yang dipasang seperti aplikasi biasa

Backend lokal **tidak bisa** dipakai di sini: APK berumur panjang, sedangkan laptopmu tidak selalu menyala. Jadi preview butuh Supabase di cloud.

### Sekali seumur hidup project

**1. Buat project Supabase cloud** — [supabase.com/dashboard](https://supabase.com/dashboard) → New project. Catat *Project Ref*, *Project URL*, dan *anon key* (Settings → API).

**2. Kirim database dan edge function ke cloud:**

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase db push
supabase secrets set --env-file supabase/.env
supabase functions deploy ambiguity-check schedule-merge identity-reflection
```

**3. Nyalakan anonymous sign-in di cloud:** Dashboard → Authentication → Providers → aktifkan **Anonymous**. Tanpa ini aplikasi tidak bisa membuat sesi dan layar pertama akan gagal.

**4. Isi `eas.json`** — ganti dua baris di profil `preview`:

```jsonc
"EXPO_PUBLIC_SUPABASE_URL": "https://<PROJECT_REF>.supabase.co",
"EXPO_PUBLIC_SUPABASE_ANON_KEY": "<anon key dari dashboard>"
```

**5. Akun Expo:**

```bash
npx eas login
```

### Setiap kali mau bikin APK baru

```bash
npx eas build --profile preview --platform android
```

Tunggu build selesai di server Expo, lalu buka link yang diberikan di HP dan pasang APK-nya.

---

## Yang sering bikin bingung

**Kenapa preview harus build ulang tiap ganti backend?**
`EXPO_PUBLIC_*` ditanam ke dalam binary saat build, bukan dibaca saat aplikasi jalan. Jadi alamat backend ikut terkunci di APK.

**Kunci mana yang aman ikut ke APK?**

| Kunci | Aman? |
|---|---|
| anon key | Ya — memang dirancang publik, RLS yang menjaga data |
| `GEMINI_API_KEY` | **Tidak pernah.** Hanya jadi secret Edge Function |
| service role key | **Tidak pernah.** Menembus semua RLS |

**Apakah dev dan preview berbagi data?**
Tidak. Dev memakai database di laptop, preview memakai database cloud. Isinya terpisah.
