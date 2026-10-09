# RonnieLogman

Trainings-App für Kraft, Laufen und Sport, als Progressive Web App (PWA).

- Läuft im Browser und lässt sich auf Android, iPhone und PC wie eine App installieren
- Funktioniert offline
- Alle Daten liegen nur lokal auf dem jeweiligen Gerät (Backup im Reiter „Daten“)

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Die komplette App |
| `manifest.webmanifest` | Name, Icon und Vollbildmodus für die Installation |
| `sw.js` | Service Worker für den Offline-Betrieb |
| `icons/` | App-Icons |

## Update einspielen

1. Geänderte `index.html` hochladen
2. In `sw.js` die Version erhöhen, z. B. `ronnielogman-v1` → `ronnielogman-v2`
3. App einmal mit Internet öffnen, beim nächsten Start ist das Update aktiv
