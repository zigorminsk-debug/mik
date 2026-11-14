# Подпись Android-приложения

Приложение подписывается **постоянным** ключом: только он позволяет ставить новые версии
поверх ранее установленных (иначе Android потребует удалить приложение и потерять данные).

## Где лежит ключ

Ключ — файл PKCS12 (`mik-release.p12, RSA-2048, самоподписанный сертификат, срок 100 лет).
Хранится **на GitHub** и используется GitHub Actions при каждой сборке.

CI получает ключ из первого доступного источника:

1. **Секреты репозитория** (предпочтительно):
   `Settings → Secrets and variables → Actions → New repository secret`

   | Секрет | Значение |
   |---|---|
   | `ANDROID_KEYSTORE_BASE64` | base64 содержимого `.p12` (одной строкой) |
   | `ANDROID_KEYSTORE_PASSWORD` | пароль хранилища |
   | `ANDROID_KEY_ALIAS` | alias ключа (`mikacademy`) |
   | `ANDROID_KEY_PASSWORD` | пароль ключа (в PKCS12 обычно равен паролю хранилища) |

2. **Ветка `signing-key`** этого же репозитория: `keystore/mik-release.p12` и
   `keystore/keystore.properties`. Сборка подтягивает её автоматически
   (`git fetch origin signing-key`). Для pull-request из форков ветка **не** читается.

3. Если ключа нет ни там, ни там — собирается только debug-APK, шаг release пропускается
   с предупреждением.

## Как восстановить ключ из секретов

```bash
echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > mik-release.p12
keytool -list -v -keystore mik-release.p12 -alias mikacademy -storepass "$ANDROID_KEYSTORE_PASSWORD"
```

## Как создать новый ключ (если старый утерян)

```bash
python3 -m venv .venv && .venv/bin/pip install cryptography
.venv/bin/python scripts/make-keystore.py
# → android/keystore/mik-release.p12 и android/keystore/mik-release.p12.b64
```

Скрипт пишет реквизиты в `.secrets/keystore.txt` (папка вне git).
Дальше — залить base64 в секрет `ANDROID_KEYSTORE_BASE64` и обновить пароль/alias.

> ⚠️ Новый ключ = новая «личность» приложения. Установка поверх старой версии
> невозможна: придётся удалить приложение. Старый ключ терять нельзя.

## Проверка подписи собранного APK

```bash
$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose --print-certs app-release.apk
```

В выводе должен быть сертификат с CN `MikroTik Academy Release` и теми же отпечатками,
что и у исходного ключа.

## Отпечаток текущего ключа

Сертификат: `CN=MikroTik Academy Release, O=MikroTik Academy, C=BY`
Действует до 2126 года. Точный SHA-256 можно посмотреть командой выше.
