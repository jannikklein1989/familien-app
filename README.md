# KK Home

Familien-Organisations-App (PWA) für Jannik und Irene: To-dos, Einkauf, Essen, Verträge & Fixkosten.
Plan und Entscheidungen: [`docs/PLAN.md`](docs/PLAN.md).

## Lokal starten

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # Logik-Tests (Fristen, Wiederholungen, Schnell-Eingabe)
npm run build
```

Ohne `.env` läuft die App im **Demo-Modus**: Daten liegen nur im Browser (localStorage), Beispieldaten sind vorbefüllt.

## Mit Supabase verbinden

1. Projekt auf supabase.com anlegen, Region **Frankfurt (eu-central-1)**.
2. SQL-Editor: `supabase/migrations/0001_init.sql` ausführen.
3. Auth → Providers: E-Mail (Magic Link) an, optional Google.
4. Auth → URL Configuration: Site-URL und Redirect-URL der gehosteten App eintragen.
5. `.env.example` nach `.env` kopieren und URL + anon key eintragen.

Beim ersten Login legt die erste Person einen Haushalt an. Den Einladungscode findet man in der Tabelle `households`
(Einladen per UI kommt noch), die zweite Person tritt damit bei.

## Struktur

- `src/lib/dates.ts` – Kündigungsfristen, Wiederholungen, Datumshelfer
- `src/lib/quick.ts` – Schnell-Eingabe ohne KI (Phase 3: Claude Haiku)
- `src/lib/demo.ts` / `supabase.ts` – zwei Backends hinter einer Schnittstelle
- `src/pages/*` – Screens
- `supabase/migrations` – Schema inkl. Row-Level-Security
- `scripts/preview-bundle.py` – Einzeldatei-Vorschau (`VITE_PREVIEW=1 npx vite build --outDir dist-preview`)
