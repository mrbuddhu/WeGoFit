#!/bin/bash
cd /Users/mrbuddhu/Desktop/WeGoFIT/mobile

echo "=== Verifying fix: iOS bundle rebuild ==="
BUNDLE_URL="http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=ios&dev=true&hot=false&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile&cache_bust=$(date +%s)"
START=$(date +%s)
curl -s -o /tmp/ios-bundle-v2.js -w "HTTP_CODE:%{http_code}\nSIZE:%{size_download}B\n" --max-time 300 "$BUNDLE_URL"
END=$(date +%s)
echo "BUILD TIME: $((END - START))s"
echo ""

if [ ! -s /tmp/ios-bundle-v2.js ]; then
  echo "❌ Bundle EMPTY"
  exit 1
fi

FIRST=$(head -c 300 /tmp/ios-bundle-v2.js)
if echo "$FIRST" | grep -qE '"type":.*Error|"SyntaxError|UnableToResolve|TransformError'; then
  echo "❌ BUNDLE STILL HAS ERRORS:"
  echo ""
  head -c 2500 /tmp/ios-bundle-v2.js
  echo ""
  exit 1
fi

if grep -q "__d(" /tmp/ios-bundle-v2.js; then
  echo "✅ iOS BUNDLE COMPILED SUCCESSFULLY!"
  SIZE=$(wc -c < /tmp/ios-bundle-v2.js)
  echo "   Size: $SIZE bytes ($(echo "scale=2; $SIZE/1024/1024" | bc) MB)"
  MOD_COUNT=$(grep -c "^__d(" /tmp/ios-bundle-v2.js || echo 0)
  echo "   Modules: ~$MOD_COUNT"
else
  echo "⚠️  No __d() found — checking content type:"
  echo "$FIRST"
  exit 1
fi

echo ""
echo "=== Android bundle rebuild ==="
BUNDLE_URL_A="http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=android&dev=true&hot=false&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile&cache_bust=$(date +%s)"
START=$(date +%s)
curl -s -o /tmp/android-bundle-v2.js -w "HTTP_CODE:%{http_code}\nSIZE:%{size_download}B\n" --max-time 300 "$BUNDLE_URL_A"
END=$(date +%s)
echo "BUILD TIME: $((END - START))s"

if grep -q "__d(" /tmp/android-bundle-v2.js 2>/dev/null; then
  echo "✅ Android BUNDLE COMPILED SUCCESSFULLY!"
  SIZE=$(wc -c < /tmp/android-bundle-v2.js)
  echo "   Size: $SIZE bytes ($(echo "scale=2; $SIZE/1024/1024" | bc) MB)"
else
  echo "❌ Android bundle error:"
  head -c 2000 /tmp/android-bundle-v2.js 2>/dev/null
  echo ""
  exit 1
fi

echo ""
echo "=== Tunnel URL reachability test (external) ==="
TUNNEL_HOST="9rsbkjg-anonymous-8081.exp.direct"
TUNNEL_MANIFEST="https://$TUNNEL_HOST/index.exp?platform=ios&dev=true&hot=false"
echo "Manifest: $TUNNEL_MANIFEST"
curl -s -o /tmp/tunnel-manifest.json -w "HTTP_CODE:%{http_code}\nSIZE:%{size_download}B\n" --max-time 30 -k "$TUNNEL_MANIFEST"
if [ -s /tmp/tunnel-manifest.json ]; then
  FIRST2=$(head -c 200 /tmp/tunnel-manifest.json)
  if echo "$FIRST2" | grep -q '"runtimeVersion"'; then
    echo "✅ TUNNEL MANIFEST WORKING (public URL reachable)"
  else
    echo "⚠️  Tunnel returned non-manifest response. First 200 chars:"
    echo "$FIRST2"
  fi
else
  echo "⚠️  Tunnel manifest empty or unreachable (might need login, or may work on device still)"
fi
