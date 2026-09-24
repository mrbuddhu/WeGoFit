#!/bin/bash
cd /Users/mrbuddhu/Desktop/WeGoFIT/mobile

echo "=== 1. METRO SERVER STATUS ==="
curl -s --max-time 5 http://localhost:8081/status
echo ""

echo ""
echo "=== 2. PORT 8081 OPEN? ==="
if curl -s --max-time 3 http://localhost:8081/ > /dev/null 2>&1; then
  echo "✅ Port 8081 is responding"
else
  echo "❌ Port 8081 is NOT responding"
fi

echo ""
echo "=== 3. MANIFEST (iOS) HTTP STATUS ==="
curl -s -o /tmp/manifest.json -w "HTTP_CODE:%{http_code}\n" --max-time 15 "http://localhost:8081/index.exp?platform=ios&dev=true&hot=false"
echo "Manifest size: $(wc -c < /tmp/manifest.json 2>/dev/null || echo 0) bytes"
if [ -s /tmp/manifest.json ]; then
  echo "First 200 chars of manifest:"
  head -c 200 /tmp/manifest.json
  echo ""
fi

echo ""
echo "=== 4. BUILDING iOS BUNDLE ==="
BUNDLE_START=$(date +%s)
curl -s -o /tmp/ios-bundle.js -w "HTTP_CODE:%{http_code} | SIZE:%{size_download}B\n" --max-time 180 "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile"
BUNDLE_END=$(date +%s)
echo "Build time: $((BUNDLE_END - BUNDLE_START)) seconds"

echo ""
echo "=== 5. BUNDLE VALIDATION ==="
if [ -s /tmp/ios-bundle.js ]; then
  BUNDLE_SIZE=$(wc -c < /tmp/ios-bundle.js)
  echo "Bundle file exists: ${BUNDLE_SIZE} bytes"
  if grep -q "__d(" /tmp/ios-bundle.js 2>/dev/null; then
    echo "✅ VALID: Contains React Native __d() module definitions"
  else
    echo "❌ INVALID: Missing __d() module definitions - checking first 300 chars:"
    head -c 300 /tmp/ios-bundle.js
    echo ""
  fi
  echo "Checking for error patterns..."
  ERR_COUNT=$(grep -c -i "requiring unknown module\|module does not exist\|syntaxerror\|referenceerror\|typeerror" /tmp/ios-bundle.js 2>/dev/null || echo 0)
  echo "Error pattern matches: $ERR_COUNT"
else
  echo "❌ Bundle file missing or empty!"
fi

echo ""
echo "=== 6. ANDROID BUNDLE ==="
curl -s -o /tmp/android-bundle.js -w "HTTP_CODE:%{http_code} | SIZE:%{size_download}B\n" --max-time 180 "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile"
if [ -s /tmp/android-bundle.js ]; then
  echo "✅ Android bundle built: $(wc -c < /tmp/android-bundle.js) bytes"
else
  echo "❌ Android bundle failed"
fi
