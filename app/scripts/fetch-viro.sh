#!/usr/bin/env bash
# ViroReact 的 Expo SDK 58 / RN 0.88 支持（ReactVision/viro#611）已合并但还没发 npm。
# 这里按固定 commit 拉源码、构建 JS、打成 tarball，package.json 用 file: 引用它。
# 上游 devDependencies 里的 @reactvision/viro-web-renderer 指向 file:../viro-web-renderer，
# git 安装时 prepare 会因此失败，所以构建前改用 npm 上的版本。原生二进制（ios/dist）原样使用。
# npm 发布含 #611 的版本后，删掉这个脚本，改回 npx expo install @reactvision/react-viro。
set -euo pipefail
SHA=0e50f7953a76f0a53a4163678647d0a5d956c5c5
cd "$(dirname "$0")/.."
OUT="vendor/react-viro-${SHA:0:7}.tgz"
[ -f "$OUT" ] && exit 0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$TMP" init -q
git -C "$TMP" remote add origin https://github.com/ReactVision/viro.git
git -C "$TMP" fetch -q --depth 1 origin "$SHA"
git -C "$TMP" checkout -q FETCH_HEAD
(
  cd "$TMP"
  node -e 'const fs=require("fs");const p=JSON.parse(fs.readFileSync("package.json"));p.devDependencies["@reactvision/viro-web-renderer"]="^1.1.1";fs.writeFileSync("package.json",JSON.stringify(p,null,2)+"\n")'
  npm install --ignore-scripts --no-audit --no-fund --loglevel=error
  npm run build
  npm pack --silent >/dev/null
)
mkdir -p vendor
mv "$TMP"/reactvision-react-viro-*.tgz "$OUT"
