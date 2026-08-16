#!/usr/bin/env sh

set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

if ! command -v bun >/dev/null 2>&1; then
  echo "错误: 未找到 Bun，请先安装 Bun 1.3.14。" >&2
  exit 1
fi

bun install --frozen-lockfile
bun run build
