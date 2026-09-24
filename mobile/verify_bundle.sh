#!/bin/bash
cd /Users/mrbuddhu/Desktop/WeGoFIT/mobile

echo "=== 1. SYNTAX CHECK: App.js and polyfills.js via Node parse ==="
node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/App.js 2>&1 && echo "✅ App.js syntax OK" || echo "❌ App.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/lib/polyfills.js 2>&1 && echo "✅ polyfills.js syntax OK" || echo "❌ polyfills.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/contexts/AuthContext.js 2>&1 && echo "✅ AuthContext.js syntax OK" || echo "❌ AuthContext.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/contexts/AppContext.js 2>&1 && echo "✅ AppContext.js syntax OK" || echo "❌ AppContext.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/navigation/GoFitRoot.js 2>&1 && echo "✅ GoFitRoot.js syntax OK" || echo "❌ GoFitRoot.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/lib/supabase.js 2>&1 && echo "✅ supabase.js syntax OK" || echo "❌ supabase.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/lib/constants.js 2>&1 && echo "✅ constants.js syntax OK" || echo "❌ constants.js syntax FAIL"

node --check /Users/mrbuddhu/Desktop/WeGoFIT/mobile/VideoPlayerModal.js 2>&1 && echo "✅ VideoPlayerModal.js syntax OK" || echo "❌ VideoPlayerModal.js syntax FAIL"

echo ""
echo "=== 2. SYNTAX CHECK: All screens (sample) ==="
for f in /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/screens/*.js; do
  name=$(basename "$f")
  result=$(node --check "$f" 2>&1)
  if [ $? -eq 0 ]; then
    echo "✅ $name"
  else
    echo "❌ $name: $result"
  fi
done

echo ""
echo "=== 3. SYNTAX CHECK: All services & utils ==="
for f in /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/services/*.js /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/utils/*.js /Users/mrbuddhu/Desktop/WeGoFIT/mobile/src/components/*.js; do
  name=$(echo "$f" | awk -F'/src/' '{print $2}')
  result=$(node --check "$f" 2>&1)
  if [ $? -eq 0 ]; then
    echo "✅ $name"
  else
    echo "❌ $name: $result"
  fi
done

echo ""
echo "=== 4. COMPILE ACTUAL EXPO BUNDLE (via AppEntry URL) ==="
BUNDLE_URL="http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=ios&dev=true&hot=false&minify=false&modulesOnly=false&runModule=true&app=com.wegofit.mobile"
echo "URL: $BUNDLE_URL"
echo "Building bundle (may take 30-90s first time)..."
START=$(date +%s)
curl -s -o /tmp/expo-appentry-bundle.js -w "\nHTTP_CODE:%{http_code}\nSIZE:%{size_download}B\n" --max-time 300 "$BUNDLE_URL"
END=$(date +%s)
echo "BUILD TIME: $((END - START)) seconds"

echo ""
echo "=== 5. BUNDLE VALIDATION ==="
if [ -s /tmp/expo-appentry-bundle.js ]; then
  SIZE=$(wc -c < /tmp/expo-appentry-bundle.js)
  echo "Bundle size: $SIZE bytes ($(echo "scale=2; $SIZE/1024/1024" | bc) MB)"
  FIRST=$(head -c 200 /tmp/expo-appentry-bundle.js)
  echo ""
  echo "First 200 chars of bundle:"
  echo "$FIRST"
  echo ""
  if echo "$FIRST" | grep -q "UnableToResolveError\|type.*error\|Error:"; then
    echo ""
    echo "❌ BUNDLE CONTAINS ERROR! Full error message:"
    echo ""
    head -c 2000 /tmp/expo-appentry-bundle.js
    echo ""
  elif grep -q "__d(" /tmp/expo-appentry-bundle.js 2>/dev/null; then
    echo "✅ BUNDLE IS VALID: Contains React Native __d() module definitions"
    MODULE_COUNT=$(grep -c "^__d(" /tmp/expo-appentry-bundle.js 2>/dev/null || echo 0)
    echo "Total modules in bundle: ~$MODULE_COUNT"
  else
    echo "⚠️  Unknown bundle format, checking for errors..."
    head -c 1500 /tmp/expo-appentry-bundle.js
  fi
else
  echo "❌ Bundle file is EMPTY or MISSING!"
fi
