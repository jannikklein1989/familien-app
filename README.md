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

## Sprachmodus (Claude Sonnet)

Der Mikro-Button schickt den gesprochenen bzw. diktierten Text an die Edge Function `voice`.
Die ruft Claude Sonnet 5.5 auf (Effort `low`, serverseitiger Fallback auf ein anderes Modell aktiv, falls Sonnet
mal überlastet ist) und liefert To-dos, Einkauf und Rezepte zurück. In der App erscheint eine Vorschau, erst
"Speichern" trägt ein. **Der API-Key liegt nur auf dem Server, nie in der App.**

1. Supabase Dashboard → Edge Functions → Secrets: `ANTHROPIC_API_KEY` = dein Key von console.anthropic.com.
2. Funktion deployen, entweder im Dashboard (Edge Functions → Deploy a new function → Via Editor, Name `voice`,
   Inhalt von `supabase/functions/voice/index.ts` einfügen, danach unter Details "Verify JWT" ausschalten, die
   Funktion prüft den Login selbst) oder per CLI `supabase functions deploy voice --no-verify-jwt --project-ref <ref>`.
3. Fertig. Ohne Supabase (Demo-Modus) nutzt die App einen einfachen lokalen Parser.

Kosten: ca. 4.000 Input- + 300 Output-Tokens pro Eingabe, also rund 0,01 $; 300 Eingaben/Monat ≈ 2 $.

## Rezept-Import (Claude Sonnet)

Essen → Funken-Knopf: Link, Text, PDF oder Foto → Edge Function `recipe-import` → Vorschau → speichern.
Einmalig: `supabase/migrations/0002_recipes_import.sql` im SQL-Editor ausführen und die Funktion wie `voice`
deployen (Name `recipe-import`, Verify JWT aus). Kosten ca. 1–3 Cent pro Rezept.

## Struktur

- `src/lib/dates.ts` – Kündigungsfristen, Wiederholungen, Datumshelfer
- `src/lib/quick.ts` – Mengen/Einheiten, Kategorien, lokaler Parser für den Demo-Modus
- `src/lib/voice.ts` + `supabase/functions/voice` – Sprachmodus mit Claude Sonnet
- `src/lib/demo.ts` / `supabase.ts` – zwei Backends hinter einer Schnittstelle
- `src/pages/*` – Screens
- `supabase/migrations` – Schema inkl. Row-Level-Security
- `scripts/preview-bundle.py` – Einzeldatei-Vorschau (`VITE_PREVIEW=1 npx vite build --outDir dist-preview`)
