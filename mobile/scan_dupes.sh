#!/bin/bash
cd /Users/mrbuddhu/Desktop/WeGoFIT/mobile

echo "=== SCANNING: Duplicate export pattern (inline export + re-export in block) ==="
for f in src/screens/*.js src/services/*.js src/utils/*.js src/components/*.js src/contexts/*.js src/navigation/*.js src/lib/*.js; do
  [ -f "$f" ] || continue
  # Get all named inline exports: export function X or export const X =
  INLINE_EXPORTS=$(grep -oE 'export\s+(function|const|let|var|class)\s+[A-Za-z_$][A-Za-z0-9_$]*' "$f" 2>/dev/null | grep -oE '[A-Za-z_$][A-Za-z0-9_$]*$' | sort)
  # Get all names in export { ... } blocks
  BLOCK_EXPORTS=$(grep -A 50 '^export\s*{' "$f" 2>/dev/null | grep -B 50 -m 1 '^}' | grep -oE '[A-Za-z_$][A-Za-z0-9_$]*(?=\s*[,}])' 2>/dev/null | sort -u)
  # Fallback block export parsing without lookahead
  if [ -z "$BLOCK_EXPORTS" ]; then
    BLOCK_EXPORTS=$(grep -A 100 '^export\s*{' "$f" 2>/dev/null | sed -n '/^export\s*{/,/^}/p' | grep -v '^export\s*{' | grep -v '^}' | grep -oE '[A-Za-z_$][A-Za-z0-9_$]*' 2>/dev/null | sort -u)
  fi
  # Find duplicates
  DUPES=""
  for name in $BLOCK_EXPORTS; do
    if echo "$INLINE_EXPORTS" | grep -qx "$name"; then
      DUPES="$DUPES $name"
    fi
  done
  if [ -n "$DUPES" ]; then
    echo "❌ $f — DUPLICATE EXPORTS:$DUPES"
  fi
done
echo ""
echo "=== Scan complete (no news is good news) ==="
