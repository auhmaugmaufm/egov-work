#!/usr/bin/env bash
# ใช้: source scripts/check-lib.sh   (เว็บต้องรันด้วย TEST_MODE=1)
B=${B:-http://localhost:3000}
J=/tmp/egjar; mkdir -p "$J"
reset(){ rm -f "$J"/*; curl -s -X POST "$B/api/test/reset" -o /dev/null -w '%{http_code}\n'; }
clock(){ curl -s -X PUT "$B/api/test/clock" -H 'Content-Type: application/json' --data "{\"now\":\"$1\"}" -o /dev/null -w '%{http_code}\n'; }
as(){ local who=$1 id=$2 body; touch "$J/$who"
  if [[ $id =~ ^[0-9]{13}$ ]]; then body="{\"idNo\":\"$id\"}"; else body="{\"username\":\"$id\"}"; fi
  curl -s -b "$J/$who" -c "$J/$who" -H 'Content-Type: application/json' --data "$body" -o /dev/null -w '%{http_code}\n' "$B/api/test/login-as"; }
req(){ local who=$1 m=$2 p=$3 d=${4-}; touch "$J/$who"
  if [ -n "$d" ]; then curl -s -b "$J/$who" -c "$J/$who" -X "$m" -H 'Content-Type: application/json' --data "$d" -w '\n%{http_code}\n' "$B$p"
  else curl -s -b "$J/$who" -c "$J/$who" -X "$m" -w '\n%{http_code}\n' "$B$p"; fi; }
page(){ local who=$1 p=$2; touch "$J/$who"; curl -s -b "$J/$who" -c "$J/$who" -w '\n%{http_code}\n' "$B$p"; }
up(){ local who=$1 id=$2 key=$3 f=$4; touch "$J/$who"
  curl -s -b "$J/$who" -c "$J/$who" -F "docKey=$key" -F "file=@$f" -w '\n%{http_code}\n' "$B/api/drafts/$id/files"; }
upraw(){ local who=$1 p=$2 f=$3; touch "$J/$who"; curl -s -b "$J/$who" -c "$J/$who" -F "file=@$f" -w '\n%{http_code}\n' "$B$p"; }
pay(){ curl -s -X POST "$B/api/test/payments/$1/pay" -H 'Content-Type: application/json' --data "{\"amount\":$2}" -w '\n%{http_code}\n'; }
mkfiles(){ local d=/tmp/egfiles; mkdir -p "$d"
  mkpdf(){ { printf '%%PDF-1.4\n'; head -c $(( $2 - 9 )) /dev/zero | tr '\0' ' '; } > "$d/$1"; }
  mkpdf ok.pdf 1024; mkpdf s5242879.pdf 5242879; mkpdf s5242880.pdf 5242880; mkpdf s5242881.pdf 5242881
  for i in 1 2 3 4 5 6; do cp "$d/ok.pdf" "$d/m$i.pdf"; done
  printf 'hello' > "$d/fake.pdf"
  { printf '\xff\xd8\xff\xe0'; head -c 1020 /dev/zero; } > "$d/real.jpg"; cp "$d/real.jpg" "$d/plan.jpg"
  { printf '\x89PNG\r\n\x1a\n'; head -c 1016 /dev/zero; } > "$d/real.png"
  { printf 'MZ'; head -c 1022 /dev/zero; } > "$d/exe.png"
  wc -c "$d"/* ; }
