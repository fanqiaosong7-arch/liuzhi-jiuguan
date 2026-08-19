#!/bin/bash
# 0x72 DungeonTileset II 下载脚本（itch.io 多步流程，一气呵成）
# 代理: 127.0.0.1:7897 + IPv4 强制
set -e
cd "$(dirname "$0")"
PROXY="http://127.0.0.1:7897"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0"
BASE="https://0x72.itch.io/dungeontileset-ii"
JAR=cookies.txt

rm -f cookies.txt page.html confirm.html tiles.zip

echo "1. GET 主页（存 cookie）..."
curl -sL --max-time 30 -4 -x $PROXY -c $JAR -H "User-Agent: $UA" "$BASE" -o page.html -w "   HTTP %{http_code}\n"

echo "2. POST download_url（拿下载 token）..."
DLURL=$(curl -s --max-time 30 -4 -x $PROXY -b $JAR -c $JAR -H "User-Agent: $UA" -H "Referer: $BASE" \
  -X POST "$BASE/download_url" -d "as_embed=false" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).url)}catch(e){process.exit(1)}})")
echo "   token URL: ${DLURL:0:70}..."
[ -z "$DLURL" ] && { echo "❌ 拿不到 token"; exit 1; }
DLTOKEN=$(echo "$DLURL" | sed 's|.*/download/||')

echo "3. GET 下载确认页（拿 csrf）..."
curl -sL --max-time 30 -4 -x $PROXY -b $JAR -c $JAR -H "User-Agent: $UA" -H "Referer: $BASE" "$DLURL" -o confirm.html -w "   HTTP %{http_code}\n"
CSRF=$(grep -oE 'name="csrf_token" value="[^"]*"' confirm.html | head -1 | sed 's/.*value="//;s/"//')
[ -z "$CSRF" ] && { echo "❌ 拿不到 csrf"; exit 1; }
echo "   csrf: ${CSRF:0:30}..."

# 提取第一个 upload_id（通常是最新版）
UPLOAD_ID=$(grep -oE 'data-upload_id="[0-9]+"' confirm.html | head -1 | grep -oE '[0-9]+')
echo "   upload_id: $UPLOAD_ID"

echo "4. POST（完整参数 + XHR 头）..."
curl -sL --max-time 180 -4 -x $PROXY -b $JAR -c $JAR \
  -H "User-Agent: $UA" \
  -H "Referer: $DLURL" \
  -H "X-Requested-With: XMLHttpRequest" \
  -H "Accept: application/json" \
  -X POST "$DLURL" \
  --data-urlencode "csrf_token=$CSRF" \
  --data-urlencode "action=accept_nda" \
  --data-urlencode "upload_id=$UPLOAD_ID" \
  -o tiles.zip -w "   HTTP %{http_code}  %{size_download}bytes\n"

echo "5. 验证并解压..."
if file tiles.zip | grep -qi zip; then
  unzip -q -o tiles.zip && rm -f tiles.zip cookies.txt page.html confirm.html
  echo "✅ 解压成功！文件列表："
  ls
else
  echo "❌ 不是 zip："
  cat tiles.zip
  exit 1
fi
