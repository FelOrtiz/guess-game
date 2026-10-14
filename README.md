# Guess the Character

A mobile-friendly character guessing game built with Angular, Ionic, and Capacitor. It includes 400 characters across eight categories and works offline after it has been built.

## Features

- Start a game with multiple players and configure the game rules.
- Guess a character using the name, category, nationality, and optional photo shown on the card.
- Mark guesses as correct or incorrect and track scores across rounds.
- Reroll a character without changing the current player's score.
- Enable or disable any of the eight categories. Player and game settings are saved on the device.
- Browse category cards in a preview before starting a game.
- Use the app in Spanish or English.
- Play without repeating characters in the same game.

Character data is bundled in `src/assets/character.json`, and photos are bundled in `src/assets/photos/`. The app does not need a server to run after it has been built.

## Requirements

- Node.js 20.11+ or 22+, and npm.
- Android builds: Android Studio, Android SDK, and JDK 17.
- iOS builds: macOS, Xcode, CocoaPods, and Apple signing credentials to install or distribute the app.

## Run locally

```bash
npm install
npm start
```

Open <http://localhost:4200> in your browser.

## Publish to GitHub Pages

The site is published at <https://felortiz.github.io/guess-game/> using the GitHub Actions workflow in `.github/workflows/deploy-pages.yml`.

1. In the repository, open **Settings → Pages** and choose **GitHub Actions** as the publishing source.
2. Push your changes to the `main` branch. Each push builds and publishes the site. You can also start it manually from **Actions → Deploy GitHub Pages → Run workflow**.

To build the Pages version locally, run:

```bash
npm run build:pages
```

`npm run build` builds the app for Capacitor in `www/browser`.

### Add the site to your iPhone Home Screen

Open <https://felortiz.github.io/guess-game/> in Safari. Open the page menu, tap **Share → Add to Home Screen**, enable **Open as Web App**, and tap **Add**. If the option is not shown, scroll to the bottom of the share sheet, tap **Edit Actions**, and add **Add to Home Screen**. See [Apple's instructions](https://support.apple.com/guide/iphone/turn-a-website-into-an-app-iphea86e5236/ios).

When testing in Safari through a tunnel, sounds should play after tapping **Start** and during a turn. Safari does not support `navigator.vibrate`, so vibration can only be tested in the iOS app installed through Xcode and Capacitor.

## Build for Android

```bash
npm install
npm run build
npx cap add android  # Run once when adding the Android platform
npx cap sync android
npx cap open android
```

In Android Studio, run the app on a device or create an APK/AAB. For later builds, run `npm run sync` to rebuild the web app and sync the native projects.

## Build for iOS

On a Mac with Xcode:

```bash
npm install
npm run build
npx cap add ios  # Run once when adding the iOS platform
npx cap sync ios
npx cap open ios
```

In Xcode, select your signing team and device, then build and run. An Apple Developer account is required for distribution.

## Character data and photos

Each character in `src/assets/character.json` has a numeric `category_id` from 1 to 8. Photos are stored under the matching folder, with a local number from 1 to 50; for example, `src/assets/photos/1/1.jpg`. The app calculates the local photo number from the character's position in its category. If a photo is missing, the card displays the character's name as usual.

Photo attribution is recorded in `src/assets/photos/sources.json`. Category colors and labels are defined by `CATEGORY_DATA` in `src/app/app.component.ts`. Card and screen styles are in `src/app/app.component.scss`.

## Source package

This repository contains source code ready to build; it does not include a signed APK or IPA. Character `birthday` values use `YYYY-MM-DD` or `null` when no complete date is available. `isAlive` indicates whether the person or character is alive.
