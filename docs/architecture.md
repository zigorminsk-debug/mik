# Архитектура

## Общая схема

```
┌───────────────────────────┐        ┌──────────────────────────────┐
│  GitHub                    │        │  Android-устройство           │
│                           │        │                              │
│  web/  ──► build-apk.yml  │───────►│  MikAcademy.apk (подписан)   │
│         (копия в assets)  │        │    └─ MainActivity.kt         │
│                           │        │         └─ WebViewAssetLoader│
│  секреты Actions ─────────┼───────►│              └─ web/ (offline)│
│  (постоянный ключ)        │        │                              │
└───────────────────────────┘        └──────────────────────────────┘
```

## Веб-приложение

Одностраничник без фреймворков и сборки — чистый ES5+ JavaScript, который работает
и в мобильном WebView, и в обычном браузере.

| Файл | Назначение |
|---|---|
| `index.html` | Каркас: топбар, сайдбар с главами, контейнер урока, модалка поиска, splash |
| `assets/css/app.css` | Тема (тёмная/светлая), адаптивная вёрстка, компоненты |
| `assets/js/app.js` | Роутер по hash, прогресс, поиск, шпаргалка, экзамен, SW-регистрация |
| `assets/js/render.js` | Рендер блоков урока, шагов, чек-листов, тестов, видео |
| `assets/data/ch*.js` | Контент: главы и уроки (текст, код, ошибки, чек-листы, вопросы) |

**Роутинг** — hash-адреса: `#/`, `#/lesson/l07`, `#/cheat`, `#/exam`.
**Состояние** — `localStorage` (ключ `mik.state.v1`): отметки чек-листов, результаты
тестов, тема, размер шрифта. Синхронизации с сервером нет — это офлайн-приложение.

### Формат урока

```js
D.lessons['l07'] = {
  title, lead, level, time, tags,
  video: 'assets/media/video/l07.mp4',
  transcript: ['…'],                       // текст под видео и сценарий озвучки
  blocks: [ {t:'h'|'p'|'ul'|'code'|'note'|'table'|'img', …} ],
  steps:    [ {title, text, cmd, note} ],  // пошаговая инструкция
  pitfalls: [ {t, d} ],                    // типичные ошибки
  checklist: ['…'],                        // практические пункты
  quiz:     [ {q, o:[…], a, why} ],        // вопросы с пояснениями
  cheat:    [ {g, c, d} ],                 // записи для шпаргалки
  summary: '…'
};
```

Один формат для всех уроков — рендер и валидатор работают одинаково.

## Android-обёртка

* `MainActivity` (Kotlin) — единственная Activity.
* `WebViewAssetLoader` отдаёт `assets/www` по адресу
  `https://appassets.androidplatform.net/assets/www/index.html`.
  Это даёт корректный https-origin: работают `localStorage`, `fetch`, service worker.
* Кнопка «назад» ходит по истории WebView, внешние ссылки открываются в системном браузере.
* `minSdk 24`, `targetSdk 34`, `compileSdk 34`, AGP 8.5.2, Kotlin 1.9.24, Gradle 8.7.
* Веб-исходники копируются задачей `syncWebAssets` (Gradle `Copy`) в
  `build/generated/webAssets` — в репозитории нет дублей.

### Размер APK

Видео — основной вес (~36 МБ на 21 ролик). Если нужен «лёгкий» вариант,
достаточно исключить `assets/media/video` из `syncWebAssets` и оставить текстовый курс.

## Сборка медиа

```
media/narration.json  ← node scripts/extract-narration.mjs (тексты уроков + CLI-примеры)
        │
        ├── media/audio/<id>-p1.mp3 … (озвучка)
        │
        └── scripts/make-videos.py → слайды Pillow → ffmpeg → web/assets/media/video/<id>.mp4
```

Слайды: титул → абзацы объяснения → слайды с реальными CLI-командами → итог.
Кодек: H.264 baseline, yuv420p, AAC 96 кбит/с, `+faststart` — играется в WebView на Android 7+.

## CI/CD

| Воркфлоу | Что делает |
|---|---|
| `build-apk.yml` | Валидация данных → debug APK → подписанный release APK → проверка подписи → артефакты; при теге `v*` — релиз |
| `pages.yml` | Публикация `web/` на GitHub Pages |
| `ci.yml` | Проверка данных курса и дымовой тест веб-приложения (jsdom) |

Ключ подписи: только секреты репозитория (`ANDROID_KEYSTORE_BASE64` и др.).
Если их нет — собирается лишь debug-APK, release пропускается.
Подробности — в [signing.md](signing.md).
