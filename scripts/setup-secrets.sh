#!/usr/bin/env bash
# Разовое добавление постоянного ключа подписи в секреты GitHub Actions.
#
# Требуется gh CLI, авторизованный в аккаунте, у которого есть права
# Administration → Actions → Secrets для этого репозитория
# (например `gh auth login` с правом repo).
#
#   ./scripts/setup-secrets.sh
#
# Ключ читается из android/keystore/mik-release.p12, реквизиты — из
# .secrets/keystore.txt. Ничего из этого не попадает в git.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEYSTORE="$ROOT/android/keystore/mik-release.p12"
CREDS="$ROOT/.secrets/keystore.txt"

if [ ! -f "$KEYSTORE" ]; then
  echo "✗ Нет файла $KEYSTORE" >&2
  echo "  Создайте ключ: .venv/bin/python scripts/make-keystore.py" >&2
  exit 1
fi
if [ ! -f "$CREDS" ]; then
  echo "✗ Нет файла $CREDS с реквизитами ключа" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "✗ Не найден gh CLI" >&2
  exit 1
fi

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
if [ -z "$REPO" ] || [ "$REPO" = "null" ]; then
  echo "✗ Не удалось определить репозиторий" >&2
  exit 1
fi

ALIAS="$(grep '^alias=' "$CREDS" | cut -d= -f2-)"
PASSWORD="$(grep '^password=' "$CREDS" | cut -d= -f2-)"
if [ -z "$ALIAS" ] || [ -z "$PASSWORD" ]; then
  echo "✗ В $CREDS нет alias/password" >&2
  exit 1
fi

BASE64="$(base64 -w0 "$KEYSTORE")"

echo "▶ Секреты для $REPO"
gh secret set ANDROID_KEYSTORE_BASE64 --repo "$REPO" --body "$BASE64"
gh secret set ANDROID_KEYSTORE_PASSWORD --repo "$REPO" --body "$PASSWORD"
gh secret set ANDROID_KEY_ALIAS --repo "$REPO" --body "$ALIAS"
gh secret set ANDROID_KEY_PASSWORD --repo "$REPO" --body "$PASSWORD"

echo
echo "✔ Готово. Секреты:"
gh secret list --repo "$REPO"
echo
echo "Теперь запустите сборку: Actions → «Сборка APK» → Run workflow."
