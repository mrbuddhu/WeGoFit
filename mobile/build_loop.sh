#!/bin/bash
cd /Users/mrbuddhu/Desktop/WeGoFIT/mobile

ATTEMPT=1
MAX_ATTEMPTS=8
ERRORS_FOUND=true

while [ "$ERRORS_FOUND" = "true" ] && [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  echo ""
  echo "========================================================"
  echo "  BUNDLE ATTEMPT $ATTEMPT / $MAX_ATTEMPTS"
  echo "========================================================"

  BUNDLE_URL="http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=ios&dev=true&hot=false&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile&attempt=$ATTEMPT"
  START=$(date +%s)
  curl -s -o /tmp/current-bundle.js -w "HTTP_CODE:%{http_code}\nSIZE:%{size_download}B\n" --max-time 600 "$BUNDLE_URL"
  END=$(date +%s)
  echo "BUILD_TIME: $((END - START))s"
  echo ""

  FIRST=$(head -c 400 /tmp/current-bundle.js)

  # Check for JSON error response
  if echo "$FIRST" | grep -qE '^\{"type":'; then
    ERR_TYPE=$(echo "$FIRST" | grep -oE '"type":"[^"]+"' | head -1 | cut -d'"' -f4)
    ERR_FILE=$(grep -oE '"filename":"[^"]+"' /tmp/current-bundle.js 2>/dev/null | head -1 | cut -d'"' -f4)
    ERR_MSG=$(grep -oE '"message":"[^"]{0,300}"' /tmp/current-bundle.js 2>/dev/null | head -1 | cut -d'"' -f4)
    echo "❌ ERROR FOUND:"
    echo "   Type:     $ERR_TYPE"
    echo "   File:     $ERR_FILE"
    echo "   Message:  $ERR_MSG"
    echo ""
    echo "--- Raw first 2500 chars ---"
    head -c 2500 /tmp/current-bundle.js
    echo ""
    ATTEMPT=$((ATTEMPT + 1))
    ERRORS_FOUND=true
    echo ""
    echo "Fix the above error and re-run, or hit another error below..."
    break
  else
    ERRORS_FOUND=false
  fi
done

if [ "$ERRORS_FOUND" = "false" ]; then
  echo ""
  echo "🎉 BUNDLE COMPILED SUCCESSFULLY (no error JSON)!"
  SIZE=$(wc -c < /tmp/current-bundle.js 2>/dev/null || echo 0)
  echo "   Size: $SIZE bytes ($(echo "scale=2; $SIZE/1024/1024" | bc 2>/dev/null) MB)"
  if grep -q "__d(" /tmp/current-bundle.js 2>/dev/null; then
    MOD_COUNT=$(grep -c "^__d(" /tmp/current-bundle.js 2>/dev/null || echo 0)
    echo "   React Native modules (__d): $MOD_COUNT"
  fi
  if grep -q "ProfileScreen\|GoFitRoot\|AuthContext" /tmp/current-bundle.js 2>/dev/null; then
    echo "   ✅ App modules are bundled (ProfileScreen/GoFitRoot/AuthContext found)"
  fi

  echo ""
  echo "=== Android build test ==="
  curl -s -o /tmp/android-bundle-final.js -w "HTTP_CODE:%{http_code}\nSIZE:%{size_download}B\n" --max-time 600 "http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=android&dev=true&hot=false&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile&final=1"
  if grep -q "^__d(" /tmp/android-bundle-final.js 2>/dev/null; then
    echo "✅ Android bundle compiled successfully too!"
  else
    ANDROID_ERR=$(head -c 300 /tmp/android-bundle-final.js)
    if echo "$ANDROID_ERR" | grep -qE '^\{"type":'; then
      echo "❌ Android has errors:"
      echo "$ANDROID_ERR"
    else
      echo "⚠️  Android bundle unknown format (first 200 chars):"
      echo "$ANDROID_ERR"
    fi
  fi
fi
