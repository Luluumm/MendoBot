# Codex Changes - 2026-06-04

## Backup Created

- Focused rollback backup: `C:\Users\lucan\Documents\GitHub\MendoBot-backups\MendoBot-source-backup-before-codex-20260604-170010.zip`
- A full-folder archive was also attempted first: `C:\Users\lucan\Documents\GitHub\MendoBot-backups\MendoBot-before-codex-20260604-165731.zip`
- The full-folder archive is readable, but it timed out while compressing large runtime folders like `node_modules`, `chrome`, and WhatsApp cache files. Use the focused backup for source/config/data rollback.

## Existing Data Locations

- Stops are loaded from `json/mendotran-stops.json`.
- Buses are loaded from `json/mendotran-buses.json`.
- Metrotranvia station mappings are loaded from `json/metrotranvia.json`.
- Database compatibility is checked with `json/.bbdd-version.json`.
- The generator that creates these files is `src/modules/mendotran/generateDatabase.ts`.

## Added Saved Stops

- New saved-stop storage module: `src/modules/mendotran/savedStops.ts`.
- Saved aliases are stored in `json/saved-stops.json`.
- Aliases are scoped by the WhatsApp chat/contact ID, so each sender can have their own `ESCUELA`, `CASA`, etc.
- New commands:
  - `GuardarParada ESCUELA M4779`
  - `Guardar ESCUELA M4779`
  - `Save ESCUELA M4779`
  - `MisParadas`
- Existing commands now resolve saved aliases:
  - `Micro 352 ESCUELA`
  - `Parada ESCUELA`

## Added Arrival Reminders

- New commands:
  - `Recordatorio 352 ESCUELA`
  - `Reminder 352 M4779`
  - `Recordar 352 ESCUELA`
- The bot finds the next arrival for that bus at that stop and schedules a WhatsApp message 5 minutes before arrival.
- Reminder timers are in memory, so they do not survive a bot restart.

## Added Location Support Path

- `src/modules/whatsapp/client.ts` now accepts WhatsApp location messages even when non-text messages are otherwise ignored.
- If the local stop database contains coordinates, the bot replies with the 15 nearest stops and their bus lists.
- The existing `json/mendotran-stops.json` does not contain coordinates yet. `src/modules/mendotran/generateDatabase.ts` now preserves coordinates during future `npm run refresh` runs.

## Build

- Ran `npm run build` successfully after the code changes.
