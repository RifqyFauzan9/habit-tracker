#!/usr/bin/env bash
# One command for phone development.
#
# Starts everything the app needs and points it at this machine's LAN address,
# because a phone reading 127.0.0.1 would be talking to itself.
set -euo pipefail

cd "$(dirname "$0")/.."

say() { printf '\n\033[1;32m▸ %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

# --- 1. Docker ------------------------------------------------------------
say "Cek Docker"
if ! docker info >/dev/null 2>&1; then
  echo "Docker belum jalan. Menyalakan Docker Desktop…"
  open -a Docker || die "Docker Desktop tidak ditemukan. Pasang dulu: brew install --cask docker"
  printf "Menunggu Docker siap"
  for _ in $(seq 1 60); do
    if docker info >/dev/null 2>&1; then break; fi
    printf "."; sleep 2
  done
  echo
  docker info >/dev/null 2>&1 || die "Docker tidak siap-siap. Buka Docker Desktop manual, lalu ulangi."
fi
echo "Docker siap."

# --- 2. Supabase ----------------------------------------------------------
say "Menyalakan Supabase lokal"
supabase start >/dev/null 2>&1 || true
STATUS="$(supabase status -o json 2>/dev/null)" || die "Supabase gagal start. Coba: supabase stop && supabase start"
ANON_KEY="$(printf '%s' "$STATUS" | python3 -c 'import sys,json;print(json.load(sys.stdin)["ANON_KEY"])')"
[ -n "$ANON_KEY" ] || die "Tidak bisa membaca ANON_KEY dari supabase status."
echo "Supabase jalan."

# --- 3. Alamat LAN --------------------------------------------------------
# The phone needs the laptop's address on the Wi-Fi, not localhost.
LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
[ -n "$LAN_IP" ] || die "Tidak menemukan alamat Wi-Fi. Pastikan laptop terhubung Wi-Fi (bukan cuma kabel)."

say "Menulis .env untuk HP (IP: $LAN_IP)"
cat > .env <<ENVX
# Ditulis otomatis oleh scripts/dev.sh — jangan diedit manual.
# IP ini berubah kalau kamu pindah Wi-Fi; jalankan ulang \`yarn dev\`.
EXPO_PUBLIC_SUPABASE_URL=http://$LAN_IP:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
ENVX

# --- 4. Edge functions ----------------------------------------------------
say "Menyalakan edge functions (AI)"
[ -f supabase/.env ] || die "supabase/.env tidak ada. Isi GEMINI_API_KEY dulu (lihat supabase/.env.example)."
pkill -f "supabase functions serve" >/dev/null 2>&1 || true
supabase functions serve --env-file supabase/.env > /tmp/habit-functions.log 2>&1 &
FUNCTIONS_PID=$!
# Stop the background function server when Expo exits, so no stray process survives.
trap 'kill $FUNCTIONS_PID >/dev/null 2>&1 || true' EXIT
sleep 3
echo "Edge functions jalan (log: /tmp/habit-functions.log)."

# --- 5. Expo --------------------------------------------------------------
say "Menyalakan Expo — scan QR di bawah pakai Expo Go"
echo "HP dan laptop harus satu Wi-Fi."
echo
exec npx expo start --clear
