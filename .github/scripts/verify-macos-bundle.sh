#!/usr/bin/env bash
set -euo pipefail

bundle_dir="${1:?usage: verify-macos-bundle.sh <bundle-dir> [checksum-output]}"
checksum_output="${2:-quota-beacon-macos-universal-ad-hoc.sha256}"

app_path="$(find "$bundle_dir/macos" -maxdepth 1 -type d -name '*.app' -print -quit)"
dmg_path="$(find "$bundle_dir/dmg" -maxdepth 1 -type f -name '*.dmg' -print -quit)"

if [[ -z "$app_path" || -z "$dmg_path" ]]; then
  echo "Expected one macOS app bundle and one DMG under $bundle_dir" >&2
  exit 1
fi

executable_name="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$app_path/Contents/Info.plist")"
executable_path="$app_path/Contents/MacOS/$executable_name"

codesign --verify --deep --strict --verbose=2 "$app_path"
codesign_details="$(codesign --display --verbose=4 "$app_path" 2>&1)"
grep -q '^Signature=adhoc$' <<<"$codesign_details"

architectures="$(lipo -archs "$executable_path")"
grep -qw 'arm64' <<<"$architectures"
grep -qw 'x86_64' <<<"$architectures"

hdiutil verify "$dmg_path"

dmg_dir="$(dirname "$dmg_path")"
dmg_name="$(basename "$dmg_path")"
(
  cd "$dmg_dir"
  shasum -a 256 "$dmg_name"
) > "$checksum_output"

echo "Verified ad-hoc signature, arm64/x86_64 architectures, and DMG integrity."
echo "Checksum written to $checksum_output"
