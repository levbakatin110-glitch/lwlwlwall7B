# Мая для App Store (iOS)

Сайт один: `https://hey-maya.ru`.  
Эта папка готовит **оболочку** под айфон (Capacitor), как Android-оболочка в Google Play.

## Важно про Windows

На Windows **нельзя** собрать файл для App Store (`.ipa`). Нужен:

- Mac с Xcode, **или**
- облачный Mac (Codemagic / MacStadium / GitHub macOS runner).

С этого ПК мы только готовим конфиг. Финальная кнопка «Archive» — на Mac.

## Что уже в репозитории

| Файл | Зачем |
|------|--------|
| `capacitor.config.ts` | id `ru.heymaya.app`, имя «Мая», URL сайта |
| `native-www/` | запасная страница, если WebView не открыл сайт |
| `ios/` | проект Xcode (добавлен; `pod install` только на Mac) |
| `public/.well-known/apple-app-site-association` | шаблон Universal Links (нужен Team ID) |

Иконка в Xcode сейчас из `maya-play-icon-512.png`. Для App Store лучше заменить на **1024×1024** PNG без прозрачности.

## Шаги на Mac (один раз)

1. Установить **Xcode** из App Store и согласиться с лицензией.
2. Установить CocoaPods: `sudo gem install cocoapods`
3. В папке проекта:

```bash
cd mom-ai
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

4. В Xcode:
   - Team = ваш Apple Developer аккаунт
   - Bundle ID = `ru.heymaya.app` (как в Play)
   - Signing & Capabilities → включить Push Notifications при необходимости
   - Product → Archive → Distribute App → App Store Connect

5. В [App Store Connect](https://appstoreconnect.apple.com):
   - новое приложение «Мая»
   - скриншоты, описание, политика `https://hey-maya.ru/legal/privacy`
   - удаление аккаунта: `https://hey-maya.ru/legal/delete-account`
   - отправить на Review

## Apple Developer

Нужен платный аккаунт [developer.apple.com](https://developer.apple.com) (~99 USD/год).  
Без него в App Store не опубликовать (только симулятор/свой айфон по кабелю в ограниченном режиме).

## Team ID в apple-app-site-association

После создания App ID в Apple Developer откройте Membership → Team ID.  
В файле `public/.well-known/apple-app-site-association` замените `TEAMID` на этот код, затем задеплойте сайт.

Формат appID: `TEAMID.ru.heymaya.app`

## Обновления

- Правки сайта (чат, дневники, офлайн) → деплой на сервер, **без** новой сборки iOS.
- Правки оболочки (иконка, права, Capacitor) → новый Archive в Xcode → обновление в App Store.

## Про пропуск ревью

Гарантий нет. Шансы выше, если Мая выглядит приложением (дневники, офлайн), есть политика/удаление аккаунта, а не пустая рамка сайта. ИИ на сервере сам по себе не причина отказа.
