#!/usr/bin/env sh
set -eu

REMOTE_HOST="bohai"
REMOTE_DIR="/www/wwwroot/idx.roj.ac.cn"
# 注意: assets 不带尾斜杠 —— 带尾斜杠会把目录内容拷到目标根目录(变成 icons/), 而导航引用的是 assets/icons/
FILES="index.html styles.css app.js favicon.svg assets"
PROTECT="--exclude=404.html --exclude=.htaccess --exclude=.user.ini"

DRY=""
CLEAN=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY="-n" ;;
    --clean) CLEAN="--delete $PROTECT" ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

./build.sh

echo "→ 推送至 $REMOTE_HOST:$REMOTE_DIR/"
rsync -az $DRY $CLEAN --info=stats2 $FILES "$REMOTE_HOST:$REMOTE_DIR/"