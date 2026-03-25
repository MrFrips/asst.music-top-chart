# Top Chart

> JSON API для данных о топ ежедневных треков Spotify, собранных с [Kworb.net](https://kworb.net) и обогащённых метаданными Spotify.

## Обзор

Top Chart — это **JSON API сервис** на основе Next.js, который собирает данные чартов ежедневных треков Spotify с Kworb.net, обогащает их метаданными Spotify (обложки, превью URL, ссылки на Spotify) и предоставляет через чистые REST эндпоинты.

### Ключевые возможности

- **Топ ежедневных треков** — Сбор данных с Kworb.net для 20 стран + глобальный чарт
- **Интеграция со Spotify** — Автоматическое сопоставление треков с обложками, превью URL и ссылками на Spotify
- **Исторические данные** — Ежедневные снимки с изменениями позиций в чарте
- **Поддержка нескольких стран** — Глобальный + 19 чартов по странам
- **Автообновление** — Обновление данных по расписанию через Vercel или вручную

---

## Технологический стек

| Компонент | Технология |
|-----------|-----------|
| Фреймворк | [Next.js 14](https://nextjs.org/) (App Router) |
| Язык | TypeScript |
| База данных | MySQL (production) / PostgreSQL / SQLite (разработка) |
| ORM | [Prisma](https://www.prisma.io/) |
| Скрейпинг | [Cheerio](https://cheerio.js.org/) |
| Источник API | Spotify Web API |
| Деплой | Vercel / Hostinger Node.js |

---

## Начало работы

### Требования

- Node.js 18+
- npm или yarn
- База данных MySQL / PostgreSQL / SQLite
- Учётные данные приложения [Spotify Developer](https://developer.spotify.com/dashboard)

### Установка

```bash
# Клонировать репозиторий
git clone https://github.com/lrmn7/mewwme-top-chart.git
cd mewwme-top-chart

# Установить зависимости
npm install

# Скопировать переменные окружения
cp .env.example .env
```

### Переменные окружения

Отредактируйте `.env`, указав свои учётные данные:

```env
# Обязательные
SPOTIFY_CLIENT_ID=ваш_spotify_client_id
SPOTIFY_CLIENT_SECRET=ваш_spotify_client_secret
DATABASE_URL="mysql://user:password@host:3306/database"

# Секрет для запуска обновления данных
ADMIN_SECRET=ваш_секрет

# Страны для сбора данных (через запятую)
SCRAPE_COUNTRIES=global,id,us,gb,jp,kr,de,fr,br,mx,in,au,es,it,ca,se,ph,tr,ar,nl

# Лимиты
TOP_TRACKS_LIMIT=25

# Опционально: Ротация ограничений запросов (добавьте до 3 пар Spotify клиентов)
# SPOTIFY_CLIENT_ID_2=second_client_id
# SPOTIFY_CLIENT_SECRET_2=second_client_secret

# Порт сервера (для кастомного сервера)
PORT=3301
```

### Настройка базы данных

Предоставлены три варианта схемы:
- `prisma/schema.prisma` — MySQL (по умолчанию)
- `prisma/schema.postgresql.prisma` — PostgreSQL
- `prisma/schema.sqlite.prisma` — SQLite (локальная разработка)

Для смены базы данных скопируйте нужную схему в `schema.prisma` и обновите `DATABASE_URL`.

```bash
# Сгенерировать Prisma клиент
npx prisma generate

# Применить схему к базе данных
npx prisma db push

# (Опционально) Открыть Prisma Studio для просмотра данных
npx prisma studio
```

### Запуск

```bash
# Разработка
npm run dev

# Сборка для production
npm run build
npm start
```

---

## API Эндпоинты

### Треки

| Метод | Эндпоинт | Описание |
|--------|----------|-------------|
| `GET` | `/api/stats/tracks` | Топ ежедневных треков с потоками, позицией и метаданными Spotify |
| `GET` | `/api/stats/tracks/history` | История потоков/позиций трека |
| `GET` | `/api/stats/countries` | Список поддерживаемых стран |
| `GET` | `/api/stats/last-updated` | Время последнего обновления данных |

### Параметры запроса

#### `/api/stats/tracks`
| Параметр | По умолчанию | Описание |
|-------|---------|-------------|
| `country` | `global` | Код страны (например, `id`, `us`, `gb`) |
| `limit` | `25` | Количество результатов |

#### `/api/stats/tracks/history`
| Параметр | По умолчанию | Описание |
|-------|---------|-------------|
| `track` | — | Название трека (обязательно) |
| `artist` | — | Имя исполнителя (обязательно) |
| `country` | `global` | Код страны |
| `days` | `30` | Количество дней истории |

### Администрирование

| Метод | Эндпоинт | Описание |
|--------|----------|-------------|
| `GET` | `/api/cron/refresh?secret=ВАШ_СЕКРЕТ` | Запустить обновление данных |
| `POST` | `/api/cron/refresh` | Запустить обновление данных (JSON тело) |

### Пример ответа

```json
GET /api/stats/tracks?country=global&limit=2

{
  "tracks": [
    {
      "trackId": "2plbrEY59IikOBgBGLjaoe",
      "name": "Die With A Smile",
      "mainArtistName": "Lady Gaga, Bruno Mars",
      "rank": 1,
      "previousRank": 1,
      "rankDelta": 0,
      "dailyStreams": 8500000,
      "totalStreams": 3200000000,
      "imageUrl": "https://i.scdn.co/image/...",
      "previewUrl": "https://p.scdn.co/mp3-preview/...",
      "spotifyUrl": "https://open.spotify.com/track/..."
    }
  ]
}
```

---

## Архитектура

```
src/
├── app/
│   └── api/
│       ├── cron/refresh/         # Эндпоинт обновления данных
│       └── stats/
│           ├── tracks/           # API топ треков
│           ├── countries/        # Поддерживаемые страны
│           └── last-updated/     # Время последнего обновления
├── lib/
│   ├── db.ts                     # Синглтон Prisma клиента
│   ├── types.ts                  # TypeScript интерфейсы
│   ├── spotify/
│   │   ├── auth.ts               # Мульти-клиентская авторизация Spotify с ротацией
│   │   └── metadata.ts           # Обогащение метаданными Spotify
│   ├── services/
│   │   └── statsProvider.ts      # Основной сервис агрегации данных
│   └── scraping/
│       ├── kworbTracks.ts        # Скрейпер глобального топа треков
│       ├── kworbCountry.ts       # Скрейпер чартов по странам
│       ├── kworbIndonesia.ts     # Скрейпер для Индонезии
│       └── kworbScraper.ts       # Базовые утилиты скрейпинга Kworb
├── prisma/
│   ├── schema.prisma             # MySQL схема (основная)
│   ├── schema.mysql.prisma       # Вариант MySQL
│   ├── schema.postgresql.prisma  # Вариант PostgreSQL
│   └── schema.sqlite.prisma     # Вариант SQLite
└── server.js                     # Кастомный сервер (совместим с Hostinger)
```

---

## Поток данных

```
Kworb.net  ──скрейпинг──▶  Сырые данные чарта треков
                                    │
                                    ▼
                              Spotify API
                          (обложки, URL)
                                    │
                                    ▼
                           statsProvider.ts
                           (слияние и обогащение)
                                    │
                                    ▼
                          Prisma / База данных
                                    │
                                    ▼
                           JSON API маршруты
```

1. **Скрейпинг** — Kworb.net собирается для получения топ ежедневных треков (по ежедневным прослушиваниям) в 20 странах
2. **Обогащение** — Каждый трек обогащается Spotify ID, обложкой, превью URL и ссылкой на Spotify
3. **Хранение** — Данные сохраняются в базу с ежедневными снимками для отслеживания истории
4. **Выдача** — Чистые JSON API предоставляют данные с фильтрацией и поддержкой стран

---

## Руководство по деплою

Этот проект использует **гибридную архитектуру**:
- **GitHub Actions** выполняет сбор данных (работает на серверах GitHub, без ограничений по времени)
- **Vercel** обслуживает JSON API (быстро, бессерверно)
- **База данных MySQL** хранит все данные о треках (используется совместно)

### Шаг 1: Настройка репозитория GitHub

1. Форкните или загрузите этот репозиторий в свой аккаунт GitHub

2. Перейдите в **Settings → Secrets and variables → Actions** и добавьте следующие секреты:

   | Секрет | Описание | Пример |
   |--------|-------------|---------|
   | `DATABASE_URL` | Строка подключения MySQL | `mysql://user:pass@host:3306/dbname` |
   | `SPOTIFY_CLIENT_ID` | Client ID приложения Spotify | С [Spotify Dashboard](https://developer.spotify.com/dashboard) |
   | `SPOTIFY_CLIENT_SECRET` | Client Secret приложения Spotify | С Spotify Dashboard |
   | `SCRAPE_COUNTRIES` | Страны для сбора данных | `global,id,us,gb,jp,kr` |
   | `TOP_TRACKS_LIMIT` | Макс. треков на страну | `25` |
   | `ADMIN_SECRET` | (Опционально) Секрет для ручного обновления API | Любая надёжная строка |

   > **Опционально:** Добавьте `SPOTIFY_CLIENT_ID_2`, `SPOTIFY_CLIENT_SECRET_2` и т.д. для ротации лимитов запросов

3. Убедитесь, что ваша база данных MySQL доступна из GitHub Actions (публичный эндпоинт или разрешённые IP-адреса)

### Шаг 2: Первое обновление данных

Запустите процесс вручную, чтобы впервые заполнить базу данных:

1. Перейдите на вкладку **Actions** в вашем репозитории GitHub
2. Нажмите на процесс **"Daily Stats Refresh"** слева
3. Нажмите **"Run workflow"** → **"Run workflow"** (зелёная кнопка)
4. Дождитесь завершения (~2-5 минут)

Это соберёт данные по всем настроенным странам и сохранит их в базу.

### Шаг 3: Деплой API на Vercel

1. Импортируйте ваш репозиторий GitHub на [vercel.com/new](https://vercel.com/new)

2. Добавьте те же переменные окружения в панели Vercel:
   - `DATABASE_URL`
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `ADMIN_SECRET`

3. Деплой! Ваш API теперь доступен по адресу `https://your-project.vercel.app`

### Шаг 4: Готово! 🎉

После первоначальной настройки:
- **GitHub Actions** автоматически обновляет данные **дважды в день** в 06:00 и 18:00 UTC (настраивается в `.github/workflows/refresh-cron.yml`)
- **Vercel** отдаёт свежие данные из базы через маршруты API
- Вы можете запустить обновление вручную в любое время на вкладке GitHub Actions

### Диаграмма архитектуры

```
┌─────────────────────────────────┐
│        GitHub Actions           │
│   (cron: 06:00 и 18:00 UTC)    │
│                                 │
│  1. Сбор данных с Kworb.net     │
│  2. Обогащение через Spotify API│
│  3. Запись в MySQL              │
└──────────────┬──────────────────┘
               │ запись
               ▼
┌─────────────────────────────────┐
│         База данных MySQL       │
│   TrackCurrent + TrackSnapshot  │
└──────────────┬──────────────────┘
               │ чтение
               ▼
┌─────────────────────────────────┐
│        Vercel (API)             │
│                                 │
│  /api/stats/tracks              │
│  /api/stats/tracks/history      │
│  /api/stats/countries           │
│  /api/stats/last-updated        │
└──────────────┬──────────────────┘
               │
               ▼
         Discord Bot / Клиент
```

### Расписание Cron

Отредактируйте `.github/workflows/refresh-cron.yml` для изменения расписания обновлений:

```yaml
schedule:
  - cron: '0 6,18 * * *'  # 06:00 и 18:00 UTC (13:00 и 01:00 WIB)
```

Также можно запустить вручную: **Actions → Daily Stats Refresh → Run workflow**

---

## Поддерживаемые страны

| Код | Страна | Код | Страна |
|------|---------|------|---------|
| `global` | 🌍 Глобальный | `kr` | 🇰🇷 Южная Корея |
| `us` | 🇺🇸 США | `in` | 🇮🇳 Индия |
| `gb` | 🇬🇧 Великобритания | `au` | 🇦🇺 Австралия |
| `id` | 🇮🇩 Индонезия | `es` | 🇪🇸 Испания |
| `jp` | 🇯🇵 Япония | `it` | 🇮🇹 Италия |
| `de` | 🇩🇪 Германия | `ca` | 🇨🇦 Канада |
| `fr` | 🇫🇷 Франция | `se` | 🇸🇪 Швеция |
| `br` | 🇧🇷 Бразилия | `ph` | 🇵🇭 Филиппины |
| `mx` | 🇲🇽 Мексика | `tr` | 🇹🇷 Турция |
| `nl` | 🇳🇱 Нидерланды | `ar` | 🇦🇷 Аргентина |

---

## Альтернативный деплой

### Hostinger / Кастомный Node.js

```bash
npm run build
node server.js
```

Кастомный `server.js` включает самовосстановление `.htaccess` для Apache-хостинга (LiteSpeed/Hostinger).

---

## Скрипты

| Скрипт | Описание |
|--------|-------------|
| `npm run dev` | Запустить сервер разработки |
| `npm run build` | Сборка для production |
| `npm start` | Запустить production сервер |
| `npm run lint` | Запустить ESLint |
| `npm run db:push` | Применить схему Prisma к базе данных |
| `npm run db:studio` | Открыть Prisma Studio |
| `node refresh-data.js` | Ручное обновление данных |
| `node check-data.js` | Проверка количества записей в базе данных |

---
