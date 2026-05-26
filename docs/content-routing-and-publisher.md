# Content routing: фильтрация видео для телефонов и аккаунтов

Дата: 2026-05-15

Этот документ описывает, как сейчас работает фильтрация контента на странице **Accounts**, где хранятся правила, как собираются manifest-файлы в MinIO и как будущая внешняя система телефона/публикации должна использовать эти данные, чтобы скачивать и публиковать правильные видео.

## Что решает routing

Оператору нужно сказать системе:

- какой телефон или аккаунт может публиковать какой контент;
- сколько видео заранее подготовить для публикации;
- какие видео уже были использованы конкретным аккаунтом, чтобы не повторять их для этого же аккаунта.

Для этого Dashboard хранит правила routing в Atome API/PostgreSQL, а для внешней системы публикации пишет готовые **Manifest JSON** в MinIO.

Внешняя система публикации не должна повторять логику UI и фильтров. Она читает manifest и берет только видео из него.

## Основные сущности

### ContentTheme

Это routing-тема, которую можно выбрать оператору.

Важно: смысл темы зависит от сервиса генерации.

- **SportZavod**: крупная спортивная категория.
  Примеры: `nba`, `mma`, `f1`, `nfl`, `soccer`.
- **agentMUSIC**: артист.
  Пример: `drake`, `taylor_swift`, `central_cee`.
- **StreamCut**: инфлюенсер.
  Сейчас текущий дефолт для существующих видео: `phil`.
- **Content-Zavod**: тема/категория из metadata или пути, если она понятная.

Технические темы вроде имени файла, даты, hash, `short_1_...`, `karaoke`, `music`, UUID и похожие значения могут оставаться в базе, но обычный UI их скрывает. Они нужны только для диагностики через переключатель **Показать технические темы**.

### ContentRouteRule

Правило, которое оператор сохраняет на странице **Accounts**.

Правило может быть на двух уровнях:

- `phone`: действует на весь телефон;
- `account`: действует только на конкретный аккаунт.

Если для аккаунта есть свое правило, оно имеет приоритет над правилом телефона.

Поля правила:

- `targetType`: `phone` или `account`;
- `targetId`: `phone_id` или `account_id`;
- `themeIds`: список разрешенных `ContentTheme.id`;
- `queueDepth`: сколько видео положить в manifest, от `1` до `10`;
- `status`: обычно `active`.

### ContentVideo

Индекс видео, найденного в MinIO.

Видео не копируется. Atome API хранит только ссылку на исходный объект:

- `bucket`: обычно `atome-videos`;
- `minioKey`: путь к `.mp4` в MinIO;
- `serviceKey`: сервис генерации;
- `themeKey`: routing-тема;
- `caption`, `hashtags`, `metaJson`;
- `status`: `ready` или `unclassified`.

### ContentDelivery

История использования видео аккаунтом.

После успешной публикации внешняя система должна сообщить Atome API, что конкретный `account_id` опубликовал конкретный `video_id`. Тогда это видео больше не попадет в manifest этого аккаунта.

Повтор запрещен по `account_id`, а не по телефону. То же видео может быть использовано другим аккаунтом, если тема подходит.

## Как оператор настраивает фильтр

На странице **Accounts** оператор делает так:

1. Выбирает один или несколько телефонов/аккаунтов в дереве `Телефон -> аккаунты`.
2. Выбирает сервис генерации:
   - `SportZavod`;
   - `agentMUSIC`;
   - `StreamCut`;
   - `Content-Zavod`.
3. Выбирает темы/артистов/инфлюенсеров выбранного сервиса.
4. Указывает **Сколько видео подготовить**.
   Это `queueDepth`: максимум сколько видео должно попасть в manifest.
5. Нажимает **Сохранить правила**.
6. Нажимает **Обновить видео из MinIO**, если появились новые видео.
7. Нажимает **Собрать manifest**, чтобы manifest-файлы в MinIO обновились.

## Текущая логика по сервисам

### SportZavod

Оператор выбирает крупные категории:

- `NFL`
- `NBA`
- `SOCCER`
- `MMA`
- `F1`
- `MOTORSPORT`
- `SPORTS_BIZ`
- `LIFESTYLE`
- `NCAA`
- `MLB`
- `NHL`
- `SPORTS_TECH`
- `BOXING`
- `ESPORTS`
- `EXTREME`
- `AI`

Внутренние подкатегории генератора, например `nba_news`, `mma_analysis`, `f1_news`, не выбираются оператором. Scanner схлопывает их в крупную тему:

- `nba_news` -> `nba`;
- `mma_analysis` -> `mma`;
- `f1_news` -> `f1`;
- `nfl_tactics` -> `nfl`;
- `soccer_transfers` -> `soccer`.

Если в metadata есть `account_theme`, например `NBA`, scanner использует его.

### agentMUSIC

Оператор должен выбирать **артистов**, а не сценарии вроде `karaoke`.

Правильные поля metadata для видео:

```json
{
  "source_service": "agentmusic",
  "artist": "Drake",
  "track_name": "Drake - Example Track",
  "scenario": "karaoke"
}
```

Допустимые варианты полей:

- `artist`;
- `artist_name`;
- `artistName`.

Если артиста нет, видео получает `status = "unclassified"` и не попадает в обычный выбор.

Сценарии `karaoke`, `lyrics`, `music`, `chorus` считаются техническими и не должны использоваться как routing-фильтр.

### StreamCut

Оператор должен выбирать **инфлюенсеров**, а не категории вроде `AI` или `STREAMING`.

Правильные поля metadata для видео:

```json
{
  "source_service": "streamcut",
  "influencer": "Phil",
  "title": "The Secret to Successful Streaming"
}
```

Допустимые варианты полей:

- `influencer`;
- `influencer_name`;
- `influencerName`;
- `creator`;
- `creator_name`;
- `creatorName`;
- `speaker`;
- `speaker_name`;
- `speakerName`;
- `person`.

Сейчас для старых StreamCut-видео без metadata используется дефолт `Phil`, поэтому они индексируются как `streamcut/phil`.

Категории `AI`, `BUSINESS`, `CLIPS`, `EDUCATION`, `GAMING`, `LIFESTYLE`, `PODCASTS`, `STREAMING` считаются техническими и скрыты из обычного UI.

### Content-Zavod

Content-Zavod пока использует понятную тему из metadata или пути.

Желательно писать в metadata одно из полей:

- `theme_key`;
- `theme`;
- `pool_key`;
- `topic`;
- `category`.

Если тема непонятна или видео лежит как hash/file без metadata, оно становится `unclassified`.

## Scanner MinIO

Endpoint:

```http
POST /api/content-routing/scan-minio
```

Что делает:

1. Сканирует bucket `atome-videos`.
2. Находит `.mp4`.
3. Ищет рядом metadata `.json`:
   - `same-name.json`;
   - или `prompt.json` в той же папке.
4. Определяет `serviceKey`.
5. Определяет routing-тему по правилам сервиса.
6. Создает/обновляет `ContentTheme`.
7. Создает/обновляет `ContentVideo`.
8. Не копирует `.mp4`.

Если тему определить нельзя, видео получает:

```json
{
  "themeKey": "unclassified",
  "status": "unclassified"
}
```

Такое видео не попадет в manifest.

## Manifest builder

Endpoint:

```http
POST /api/content-routing/build-manifests
```

Что делает:

1. Берет active телефоны и active аккаунты.
2. Для каждого аккаунта ищет правило:
   - сначала `account` rule;
   - если его нет, берет `phone` rule.
3. Берет только видео:
   - `status = "ready"`;
   - `serviceKey/themeKey` совпадают с выбранными темами;
   - видео еще не опубликовано этим `account_id`.
4. Ограничивает список по `queueDepth`.
5. Пишет manifest-файлы в MinIO.

## Где лежат manifest-файлы

Account manifest:

```text
routing/accounts/{account_id}/manifest.json
```

Phone manifest:

```text
routing/phones/{phone_id}/manifest.json
```

Оба файла пишутся в bucket `atome-videos`.

## Формат account manifest

Пример:

```json
{
  "version": 1,
  "generated_at": "2026-05-15T12:00:00.000Z",
  "target_type": "account",
  "account_id": "acc_123",
  "phone_id": "phone_ABC",
  "username": "@example",
  "rule_source": "phone",
  "queue_depth": 3,
  "allowed_themes": [
    {
      "id": "theme_id",
      "service_key": "sportzavod",
      "theme_key": "nba",
      "name": "NBA"
    }
  ],
  "videos": [
    {
      "video_id": "video_id",
      "service_key": "sportzavod",
      "theme_key": "nba",
      "minio_bucket": "atome-videos",
      "minio_key": "sportzavod/2026-05-15/nba/video.mp4",
      "metadata_key": "sportzavod/2026-05-15/nba/video.json",
      "caption": "Caption text",
      "hashtags": ["nba", "sports"],
      "metadata": {}
    }
  ]
}
```

## Формат phone manifest

Пример:

```json
{
  "version": 1,
  "generated_at": "2026-05-15T12:00:00.000Z",
  "target_type": "phone",
  "phone_id": "phone_ABC",
  "accounts": [
    {
      "account_id": "acc_123",
      "username": "@example",
      "manifest_key": "routing/accounts/acc_123/manifest.json",
      "manifest": {
        "version": 1,
        "target_type": "account",
        "account_id": "acc_123",
        "videos": []
      }
    }
  ]
}
```

## Как внешней системе телефона использовать routing

Внешняя система телефона должна знать свой `phone_id`.

Алгоритм:

1. Телефон или управляющий publisher получает `phone_id`.
2. Читает из MinIO:

```text
atome-videos/routing/phones/{phone_id}/manifest.json
```

3. Для каждого аккаунта в `accounts[]`:
   - берет вложенный `manifest`;
   - или отдельно читает `manifest_key`.
4. Выбирает видео из `manifest.videos[]`.
5. Скачивает `.mp4` из MinIO по:

```text
bucket = video.minio_bucket
key = video.minio_key
```

6. Публикует видео в нужный аккаунт.
7. Использует `caption`, `hashtags`, `metadata` из manifest.
8. После успешной публикации сообщает Atome API о delivery.

## Как скачать видео из MinIO

Publisher должен использовать MinIO/S3 client и взять объект:

```text
bucket: atome-videos
key: video.minio_key
```

Manifest не содержит presigned URL. Он содержит стабильный `minio_key`, чтобы publisher сам скачивал объект из MinIO с нужными credentials.

## Как отметить видео опубликованным

Endpoint:

```http
POST /api/content-routing/deliveries
```

Body:

```json
{
  "account_id": "acc_123",
  "phone_id": "phone_ABC",
  "video_id": "video_id",
  "status": "published",
  "published_url": "https://..."
}
```

После этого `video_id` больше не попадет в manifest для этого `account_id`.

Если публикация не удалась, можно отправить:

```json
{
  "account_id": "acc_123",
  "phone_id": "phone_ABC",
  "video_id": "video_id",
  "status": "failed"
}
```

Сейчас исключение из будущих manifest происходит только для `status = "published"`.

## Как подключить новую систему публикации

Минимальный контракт:

1. Новая система должна знать `phone_id`.
2. Новая система должна иметь доступ к MinIO bucket `atome-videos`.
3. Новая система читает:

```text
routing/phones/{phone_id}/manifest.json
```

4. Для каждого аккаунта берет `videos[]`.
5. Для каждого video item скачивает `minio_key`.
6. Публикует в аккаунт.
7. После публикации вызывает:

```http
POST /api/content-routing/deliveries
```

8. По расписанию или по событию Atome API вызывает:

```http
POST /api/content-routing/scan-minio
POST /api/content-routing/build-manifests
```

## Важные правила для генераторов

Чтобы фильтрация работала правильно, генераторы должны писать metadata рядом с `.mp4`.

### SportZavod metadata

```json
{
  "source_service": "sportzavod",
  "account_theme": "NBA",
  "topic_key": "NBA_NEWS",
  "caption": "...",
  "hashtags": ["nba"]
}
```

### agentMUSIC metadata

```json
{
  "source_service": "agentmusic",
  "artist": "Drake",
  "track_name": "Drake - Track",
  "scenario": "karaoke",
  "caption": "...",
  "hashtags": ["music"]
}
```

### StreamCut metadata

```json
{
  "source_service": "streamcut",
  "influencer": "Phil",
  "title": "Short title",
  "caption": "...",
  "hashtags": ["streaming"]
}
```

### Content-Zavod metadata

```json
{
  "source_service": "content-zavod",
  "theme_key": "sports",
  "caption": "...",
  "hashtags": ["sports"]
}
```

## API для проверки

Получить темы:

```http
GET /api/content-routing/themes
```

Получить правила:

```http
GET /api/content-routing/rules?phone_id=&account_id=
```

Сохранить правило:

```http
PUT /api/content-routing/rules
```

Body:

```json
{
  "target_type": "phone",
  "target_id": "phone_ABC",
  "theme_ids": ["theme_id_1", "theme_id_2"],
  "queue_depth": 3
}
```

Получить индексированные видео:

```http
GET /api/content-routing/videos?service_key=streamcut
```

Запустить scan:

```http
POST /api/content-routing/scan-minio
```

Собрать manifest:

```http
POST /api/content-routing/build-manifests
```

## Текущее состояние на 2026-05-15

- SportZavod работает по крупным категориям: `nba`, `mma`, `f1`, `nfl`, `soccer` и др.
- StreamCut работает по инфлюенсеру. Текущие старые видео классифицированы как `phil`.
- agentMUSIC должен работать по артисту, но текущие старые видео не содержат artist metadata и поэтому стали `unclassified`.
- Технические старые темы остаются в базе, но скрываются в обычном UI.
- Manifest-файлы являются основным контрактом для внешней системы публикации.
