<div align="center">

# MikroTik Академия

**Практический курс по MikroTik RouterOS в виде Android-приложения (PWA).**

14 глав · 21 урок · 21 видео · 102 вопроса для самопроверки · 133 команды в шпаргалке

[![Сборка APK](https://github.com/zigorminsk-debug/mik/actions/workflows/build-apk.yml/badge.svg)](https://github.com/zigorminsk-debug/mik/actions/workflows/build-apk.yml)
[![Веб-версия](https://github.com/zigorminsk-debug/mik/actions/workflows/pages.yml/badge.svg)](https://github.com/zigorminsk-debug/mik/actions/workflows/pages.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-orange.svg)

</div>

---

## Что это

Приложение-учебник по настройке сетевого оборудования MikroTik: от первого входа в Winbox
до BGP, WireGuard, очередей и автоматизации через скрипты и REST API.

Сделано как **PWA на HTML/JS** — поэтому один и тот же код работает:

* как **Android-приложение** (обёртка на WebView + assets, собирается в подписанный APK);
* как **веб-версия** на GitHub Pages;
* как **офлайн-учебник** — service worker кэширует весь курс и видео.

### Возможности

| | |
|---|---|
| 📚 14 глав, 21 урок | От «что такое RouterOS» до BGP, VRF и чек-листа продакшена |
| 🎬 21 видео | Поясняющие ролики к каждому уроку (слайды + озвучка) |
| 🧠 102 вопроса | Тесты после каждого урока и итоговый экзамен из 20 вопросов |
| 📘 Шпаргалка | 133 команды с поиском и копированием в буфер |
| ✅ Чек-листы | Практические задания с сохранением прогресса |
| 📶 Практика | Готовые конфиги RouterOS, которые можно копировать и вставлять |
| 🔌 Офлайн | Полностью работает без интернета после первой загрузки |
| 🎨 Тёмная тема | Плюс светлая, крупный шрифт, PWA-установка |

## Быстрый старт

### Веб-версия (без сборки)

```bash
git clone https://github.com/zigorminsk-debug/mik.git
cd mik
python3 -m http.server 8080 --directory web
# открыть http://localhost:8080
```

### Android APK

APK собирается в GitHub Actions: **[Actions → Сборка APK → Run workflow](https://github.com/zigorminsk-debug/mik/actions/workflows/build-apk.yml)**.
Артефакты: `mik-academy-apk` — подписанный релизный APK, `mik-academy-apk-debug` — отладочный.
При пуше тега `v1.0.0` дополнительно создаётся релиз с подписанным APK.

Ключ подписи лежит в **секретах GitHub** (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). Добавить их один раз:

```bash
./scripts/setup-secrets.sh          # нужны права Administration → Actions → Secrets
```

Без секретов собирается только debug-APK — неподписанный релиз никогда не публикуется.
Подробности и восстановление ключа: [docs/signing.md](docs/signing.md).

Локальная сборка (нужны JDK 17 и Android SDK 34):

```bash
cd android
export MIK_KEYSTORE_PATH="$PWD/keystore/mik-release.p12"
export MIK_STORE_PASSWORD=... MIK_KEY_ALIAS=mikacademy MIK_KEY_PASSWORD=...
./gradlew :app:assembleRelease -PversionName=1.0.0 -PversionCode=1
```

## Структура репозитория

```
mik/
├── web/                     # само приложение (HTML/CSS/JS, PWA)
│   ├── index.html           # оболочка: сайдбар, роутер, поиск
│   ├── manifest.webmanifest # PWA-манифест
│   ├── sw.js                # service worker: офлайн-кэш
│   ├── assets/
│   │   ├── css/app.css      # тёмная/светлая тема, адаптив под телефон
│   │   ├── js/              # app.js (роутер, прогресс, поиск), render.js (рендер уроков)
│   │   ├── data/ch*.js      # контент курса: 14 глав, 21 урок, тесты, шпаргалка
│   │   ├── img/             # иконки, постер
│   │   └── media/video/     # 21 видео (mp4, ~36 МБ)
├── android/                 # нативная обёртка (Kotlin + WebViewAssetLoader)
│   ├── app/src/main/java/com/mikacademy/app/MainActivity.kt
│   └── app/build.gradle.kts # копирует /web в assets на этапе сборки
├── scripts/                 # генераторы: иконки, видео, ключ подписи, валидация
├── media/                   # промежуточные материалы: озвучка, транскрипты
├── docs/                    # документация: подпись, архитектура, контент
└── .github/workflows/       # build-apk.yml (APK), ci.yml (проверки), pages.yml (веб-версия)
```

Исходники веб-приложения лежат **в одном месте** (`web/`); Android-сборка копирует их
в `assets/www` автоматически, поэтому дублирования нет.

## Как всё устроено

* **Контент** — обычные JS-модули в `web/assets/data/`. Каждый урок описывается данными:
  текст, блоки кода, шаги, типичные ошибки, чек-лист, вопросы с пояснениями, записи для шпаргалки.
* **Видео** — генерируются скриптом `scripts/make-videos.py`: слайды рисуются Pillow,
  озвучка синтезируется, всё собирается ffmpeg в mp4 (H.264 + AAC, совместимо с Android WebView).
* **Android** — `MainActivity` отдаёт `web/` через `WebViewAssetLoader` по адресу
  `https://appassets.androidplatform.net/...`. Это безопасный https-origin, поэтому внутри
  работают service worker, localStorage и офлайн-режим.
* **CI** — `ci.yml` проверяет целостность данных курса и прогоняет дымовой тест
  веб-приложения (jsdom); `build-apk.yml` собирает debug и подписанный release APK,
  проверяет подпись `apksigner` и выкладывает артефакты.

Подробности: [docs/architecture.md](docs/architecture.md).

## Пересборка видео

```bash
python3 -m venv .venv && .venv/bin/pip install pillow imageio-ffmpeg cryptography
node scripts/extract-narration.mjs          # тексты уроков -> media/narration.json
# озвучка кладётся в media/audio/<lesson>-p1.mp3, <lesson>-p2.mp3 ...
.venv/bin/python scripts/make-videos.py       # слайды + озвучка -> web/assets/media/video
```

Уроки без озвучки собираются как видео с субтитрами и слайдами с реальными CLI-командами.

## Проверка данных курса

```bash
node scripts/validate-content.mjs
```

Скрипт проверяет связность глав и уроков, корректность вопросов, наличие чек-листов,
видео и транскрипций. Он же запускается в CI перед сборкой.

## Лицензия

MIT — см. [LICENSE](LICENSE). Тексты курса и видео можно свободно использовать
и дорабатывать.
