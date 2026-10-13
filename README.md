# Adivina Quién — Angular + Ionic + Capacitor

Aplicación móvil de adivinar personajes, con **400 personajes** del listado suministrado.

## Funciones
- Pantalla de inicio con **Nuevo juego** y **Configurar**.
- Personaje aleatorio con **nombre grande**, **categoría coloreada** y **bandera/nacionalidad** en la esquina superior izquierda.
- Botones **Correcto (✓)** e **Incorrecto (✕)**, contadores de puntos.
- **Reroll (↻)** arriba a la derecha, sin afectar aciertos/errores.
- Configuración para activar/desactivar cualquiera de las 8 categorías, persistida en el dispositivo.
- Sin repeticiones durante una partida; pantalla de resultados al agotar el conjunto.
- Datos offline incluidos en `src/assets/character.json`. No requiere servidor una vez compilada.

## Requisitos
- Node.js 20.11+ o 22+, npm.
- Para Android: Android Studio + Android SDK + JDK 17.
- Para iOS: macOS + Xcode + CocoaPods, y firma de Apple para instalar/distribuir.

## Desarrollo web
```bash
npm install
npm start
```
Abre http://localhost:4200.

Al probar desde Safari en iPhone mediante un túnel, los pitidos deben sonar al tocar «Iniciar» y durante el turno. Safari no ofrece `navigator.vibrate`, por lo que la vibración solo se puede probar con la app iOS instalada desde Xcode mediante Capacitor.

## Compilar para Android
```bash
npm install
npm run build
npx cap add android
npx cap sync android
npx cap open android
```
En Android Studio, ejecuta en un dispositivo o genera APK/AAB. Las compilaciones siguientes requieren `npm run sync`.

## Compilar para iPhone
En un **Mac** con Xcode:
```bash
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```
En Xcode selecciona tu equipo de firma y dispositivo; compila y ejecuta. Para publicar se necesita cuenta Apple Developer.

## Datos y banderas
Las banderas se calculan de `nationality` usando coincidencias de países. Cuando la nacionalidad es ficticia, compuesta o no está reconocida, se muestra 🌐 y se conserva el texto del Excel. Puedes ampliar la tabla de banderas en `src/app/app.component.ts`.

## Personalización
- Colores y etiquetas: `CATEGORY_DATA` en `src/app/app.component.ts`.
- Diseño: `src/app/app.component.scss`.
- Personajes: `src/assets/character.json` (claves `id`, `name`, `category`, `nationality`, `birthday`, `gender` e `isAlive`). `birthday` usa `YYYY-MM-DD` o `null` si no hay fecha completa verificable. `isAlive` indica si la persona o el personaje está vivo.

> Este ZIP es **código fuente listo para compilar**, no un APK ni un IPA firmado. Las fechas completas se contrastaron con Wikidata; las fechas inciertas o no aplicables se dejaron en `null`.
