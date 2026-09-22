#!/bin/bash
# md2html.sh —— 用 GitHub Markdown API 把 Markdown 转成带样式的 HTML
#
# 用法:
#   ./md2html.sh                    # 默认 README.md -> index.html
#   ./md2html.sh doc.md             # doc.md -> doc.html
#   ./md2html.sh doc.md out.html    # doc.md -> out.html
#
# 可选环境变量:
#   GITHUB_TOKEN   设置后走认证接口，限流从 60/小时 提到 5000/小时
#   MD2HTML_THEME  样式主题，默认 dark，可填 dark / light

set -euo pipefail

# ---------- 参数 ----------
SRC="${1:-README.md}"

if [ -n "${2:-}" ]; then
  OUT="$2"
elif [ "$SRC" = "README.md" ]; then
  OUT="index.html"
else
  OUT="${SRC%.md}.html"
fi

THEME="${MD2HTML_THEME:-dark}"

# ---------- 检查 ----------
if [ ! -f "$SRC" ]; then
  echo "错误: 找不到输入文件 '$SRC'" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "错误: 需要 curl，请先安装" >&2
  exit 1
fi

# ---------- 请求头 ----------
HEADERS=(-H "Content-Type: text/plain" -H "Accept: application/vnd.github+json")
if [ -n "${GITHUB_TOKEN:-}" ]; then
  HEADERS+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
fi

# ---------- 拼装 HTML ----------
# 用 mktemp 存正文，避免把整段 HTML 塞进 shell 变量
BODY_TMP="$(mktemp)"
trap 'rm -f "$BODY_TMP"' EXIT

if ! curl -sS -f -X POST "${HEADERS[@]}" \
      --data-binary "@${SRC}" \
      https://api.github.com/markdown/raw > "$BODY_TMP"; then
  echo "错误: GitHub Markdown API 请求失败（可能是限流，试试设置 GITHUB_TOKEN）" >&2
  exit 1
fi

{
  cat <<HTML
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${SRC%.md}</title>
<link rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/github-markdown-css@5/github-markdown-${THEME}.css">
<style>
  .markdown-body {
    box-sizing: border-box;
    max-width: 820px;
    margin: 0 auto;
    padding: 40px 20px;
  }
</style>
</head>
<body class="markdown-body">
HTML
  cat "$BODY_TMP"
  cat <<'HTML'

</body>
</html>
HTML
} > "$OUT"

echo "✓ 已生成 $OUT"