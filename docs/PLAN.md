# Familien-App – Plan v1

> Stand: 23.11.2026 · Status: **Entwurf, wartet auf Freigabe** · noch kein App-Code

## TL;DR

- **Was:** Gemeinsame Organisations-PWA für Jannik (Android) und seine Frau (iPhone). Ein "Haushalt", zwei Logins, alles live synchron.
- **Stack:** React + TypeScript + Vite (PWA) · Supabase EU (Postgres, Auth, Realtime, Storage, Edge Functions) · Hosting kostenlos (Cloudflare Pages oder Vercel) · Claude Haiku 5.5 für KI-Funktionen.
- **MVP (Phase 1):** Login/Haushalt, Todos (zuweisen + wiederkehrend), Einkaufsliste (live), Verträge/Abos inkl. Fixkosten-Übersicht und Kündigungs-Erinnerung, Push-Benachrichtigungen.
- **Danach:** Phase 2 Rezepte/Wunschgerichte, Ärzte, Geburtstage/Geschenke, Notfallkontakte, Google Kalender. Phase 3 KI (Sprache, Rezept aus Link, Vertrags-PDF auslesen), Sheets-Export.
- **Kosten laufend:** realistisch 0 € plus ein paar Cent für Haiku. Optional Domain ~10 €/Jahr.
- **Aufwand grob:** MVP ~30–40 h, alles zusammen ~80–110 h (mit Claude Code als Entwickler, Jannik testet und entscheidet).

---

## 1. Ziele und Nicht-Ziele

**Ziele**
- Eine App statt fünf (Notizen, WhatsApp-Listen, Kalender, Excel, Kopf).
- Beide sehen dasselbe, sofort.
- Die App erinnert aktiv (Kündigungsfristen, fällige Todos, Geburtstage), statt dass man reinschauen muss.

**Nicht-Ziele (bewusst)**
- Kein Ausgaben-Tracking im Alltag, nur feste monatliche Posten.
- Kein Ersatz für Google Kalender. Google bleibt die Wahrheit, die App zeigt an und trägt ein.
- Keine native App im Store. Kein Multi-Familien-SaaS.
- "Frank" bleibt separat auf Janniks PC.

## 2. Architektur

```
 iPhone (Safari-PWA)      Android (Chrome-PWA)
          \                    /
           React-App (statisch gehostet, Cloudflare Pages)
                     |
              Supabase (EU, Frankfurt)
   ┌──────────┬──────────┬──────────┬──────────────────┐
   Auth       Postgres   Realtime   Storage            Edge Functions
   (Login)    (+ RLS)    (Live-     (Fotos, PDFs)      - Push versenden
                         Sync)                         - Google-Kalender-Proxy
                                                       - Haiku-Aufrufe
                     |
              pg_cron (täglich 07:00): Erinnerungen berechnen → Web Push
```

**Warum so:**
- **PWA:** Ein Code für iPhone und Android, kein App-Store, Updates sofort. Auf dem Homescreen fühlt sie sich wie eine App an.
- **Supabase:** Echte Live-Sync (wichtig für Einkaufsliste), Login, Row-Level-Security (Daten nur für euren Haushalt), Dateispeicher. Free Tier reicht für 2 Personen locker.
- **Edge Functions:** Alles mit Geheimnissen (Google-Tokens, Anthropic-API-Key, Push-Schlüssel) läuft serverseitig, nie im Browser.

**Tech-Details Frontend**
- React 19 + TypeScript + Vite, `vite-plugin-pwa` (Offline-Cache, Installierbarkeit)
- Tailwind + shadcn/ui (schnell, sauber, mobil-first)
- TanStack Query + Supabase Realtime für Daten
- Bottom-Navigation: Heute · To-dos · Mikro · Einkauf · Essen; Geld, Verträge, Ärzte, Kontakte über "Mehr" (Profil-Button oben rechts)

### ⚠ Wichtige Plattform-Fallstricke

| Thema | Problem | Lösung |
|---|---|---|
| **iOS-Push** | Web Push geht auf dem iPhone nur, wenn die PWA zum Homescreen hinzugefügt wurde (ab iOS 16.4). | Onboarding-Screen "Zum Homescreen hinzufügen", erst dann Push aktivieren. |
| **Google OAuth** | Kalender-Zugriff ist ein "sensibler" Scope. Im Testmodus laufen die Tokens nach 7 Tagen ab. | Google-Cloud-App auf "In Produktion" stellen ohne Verifizierung. Ihr seht einmal einen Warnbildschirm, dafür bleibt der Zugang dauerhaft. (Annahme, beim Bau prüfen.) |
| **Spracheingabe iOS** | Die Browser-Spracherkennung ist in iOS-PWAs unzuverlässig. | Diktier-Mikro der Handy-Tastatur nutzen (geht auf beiden Handys) und Haiku wandelt den Text in Todo/Termin um. Siehe Phase 3. |
| **Supabase Free** | Projekt pausiert nach 7 Tagen ohne Aktivität. | Bei täglicher Nutzung kein Thema. Der tägliche Cron-Job hält es zusätzlich wach. |

## 3. Datenmodell (Postgres)

Alle Tabellen haben `id uuid`, `household_id`, `created_at`, `created_by`. RLS-Regel überall: *nur Mitglieder des Haushalts lesen/schreiben*.

**Basis**
- `households` (name)
- `profiles` (user_id, household_id, display_name, color, avatar)
- `push_subscriptions` (user_id, endpoint, keys)

**Todos**
- `todos` (title, notes, assignee_id → profiles | null = beide, due_date, due_time, priority, list/category, done_at, done_by, recurrence_id)
- `recurrence` als JSON-Feld direkt am To-do (freq, interval, mode: `fixed` = fester Rhythmus | `after_done` = ab Erledigung)
  - Logik: Beim Abhaken springt das Fälligkeitsdatum auf den nächsten Termin. Simpel und robust, keine Endlos-Serien in der DB.

**Einkauf**
- `shopping_items` (name, quantity, unit, category/Gang, checked, checked_by, source_recipe_id)
- `shopping_favorites` (Name, Häufigkeit → Autovervollständigung "Milch" nach 1 Buchstaben)

**Verträge, Abos, Fixkosten**
- `contracts`
  - Stammdaten: name, provider, category (Versicherung, Strom, Handy, Streaming, …), owner_id (wem gehört's), customer_number, contract_number
  - Geld: amount, interval (monatlich/quartalsweise/jährlich), payment_day, direction (`expense` | `income`)
  - Laufzeit: start_date, min_term_months, renewal_months, notice_period_value + unit (Tage/Wochen/Monate), `monthly_cancellable_after_min_term` (bool)
  - Kündigung: cancel_url, cancel_email, cancel_notes, status (aktiv/gekündigt/beendet), cancelled_at, end_date
  - Berechnet (View): `next_cancellation_deadline`, `monthly_equivalent`
- `contract_documents` (contract_id, storage_path, title) → Phase 3 (Dokumenten-Safe)
- Einnahmen (Gehalt, Kindergeld …) sind einfach `contracts` mit `direction = income`. Kein extra Modul nötig.

> 💡 Rechtlicher Kniff: Seit dem Gesetz für faire Verbraucherverträge (03/2022) sind viele neue Verbraucherverträge nach der Mindestlaufzeit monatlich kündbar. Das Flag `monthly_cancellable_after_min_term` bildet das ab, damit die Fristberechnung stimmt. Gilt nicht für alles (z. B. Versicherungen), daher pro Vertrag einstellbar.

**Rezepte & Wunschgerichte (Phase 2)**
- `recipes` (title, url, image_path, wished_by, is_wish (bool), is_favorite, servings, prep_minutes, tags[], steps text, last_cooked_at)
- `recipe_ingredients` (recipe_id, name, quantity, unit)
- Ein Wunschgericht ist ein Rezept mit `is_wish = true`. Nach dem Kochen kann man es zum Rezept "befördern".

**Personen & Gesundheit (Phase 2)**
- `doctors` (person_id → profiles, specialty, name, practice, phone, address, url, notes, last_visit, checkup_interval_months → Erinnerung)
- `contacts` (name, relation, birthday, phone, email, is_emergency, notes) → deckt Geburtstage und Notfallkontakte ab
- `gift_ideas` (contact_id, idea, url, price, status: Idee/gekauft/verschenkt, occasion)

**Kalender (Phase 2)**
- `google_connections` (user_id, refresh_token verschlüsselt, calendar_ids) – nur serverseitig lesbar
- Termine werden **nicht** in der DB gespiegelt, sondern live über die Edge Function geladen (kein Sync-Chaos).

**System**
- `reminders_log` (Typ, Objekt-ID, gesendet am) → verhindert doppelte Pushes

## 4. Features und Phasen

### Phase 1 – MVP (Ziel: im Alltag nutzbar)
1. **Login & Haushalt:** Magic Link oder Passwort, Jannik lädt Frau per Link ein. PWA installierbar, Onboarding für Homescreen + Push.
2. **Heute-Screen:** Fällige Todos (meine/ihre/gemeinsam), anstehende Fristen, nächste Termine (ab Phase 2).
3. **Todos:** anlegen, zuweisen (ich/sie/beide), Fälligkeit, wiederkehrend, abhaken, Push bei Zuweisung und Fälligkeit.
4. **Einkaufsliste:** Live-Sync, Abhaken, Kategorien nach Supermarkt-Gang, Autovervollständigung aus Favoriten, "Erledigte löschen".
5. **Verträge/Abos:** Erfassen inkl. Laufzeit, Frist, Kündigungslink. Übersicht Fixkosten pro Monat (Ausgaben, Einnahmen, Saldo, nach Kategorie, wer zahlt was).
6. **Kündigungs-Erinnerung:** Push an beide 30 und 7 Tage vor Fristende (einstellbar), mit Direkt-Button zum Kündigungslink.

### Phase 2 – Alltag komplett
7. **Wunschgerichte & Rezepte:** Jeder trägt ein (mit/ohne Link), Favoriten, Tags, "Zutaten auf Einkaufsliste".
8. **Ärzte pro Person** + Vorsorge-Erinnerung (z. B. Zahnarzt alle 6 Monate).
9. **Geburtstage & Geschenkideen**, Push 14 und 3 Tage vorher.
10. **Notfallkontakte** (schnell erreichbar, Anruf-Button).
11. **Google Kalender:** beide Kalender (plus gemeinsamer) anzeigen, Termin aus der App eintragen.

### Phase 3 – KI & Komfort
12. **[vorgezogen und gebaut, 23.11.: Claude Sonnet 5.5 statt Haiku, Edge Function `voice`, Web-Speech-Mikro + Vorschau]** **"Sag's mir"-Eingabe:** Ein Textfeld mit Tastatur-Diktat. Beispiel: *"Erinner Anna Freitag an den Zahnarzt und setz Milch auf die Einkaufsliste"* → Haiku erzeugt per Tool-Use ein Todo + einen Einkaufslisteneintrag. Vor dem Speichern wird eine Vorschau zur Bestätigung angezeigt.
13. **Rezept aus Link:** URL einfügen → Seite wird serverseitig geladen → Haiku extrahiert Titel, Zutaten, Schritte (viele Rezeptseiten haben zusätzlich strukturierte Daten, die zuerst genutzt werden; Haiku nur als Fallback).
14. **Vertrag fotografieren/PDF:** Haiku liest Anbieter, Betrag, Laufzeit, Kündigungsfrist und füllt das Formular vor.
15. **Dokumenten-Safe** (Versicherungsscheine, Garantien) verknüpft mit Verträgen.
16. **Export nach Google Sheets** (Fixkosten/Verträge), z. B. monatlich oder auf Knopfdruck.

**Bewusst geparkt (Ideen-Backlog):** Ausgaben teilen/ausgleichen, Haushaltsplan mit Punkten, Wochen-Essensplan, Widgets, Apple-/Google-Wallet.

## 5. KI-Kosten (Haiku 5.5)

Preis: 0,10 $ pro 1 Mio. Input-Tokens, 0,50 $ pro 1 Mio. Output-Tokens (Stand 11/2026).

| Szenario | Annahme | Kosten/Monat |
|---|---|---|
| Sprach-/Texteingabe | 10 Befehle/Tag, je ~1.500 In + 200 Out | ~0,05 $ |
| Rezept aus Link | 20/Monat, je ~8.000 In + 1.000 Out | ~0,03 $ |
| Vertrags-PDF | 5/Monat, je ~10.000 In + 500 Out | <0,01 $ |
| **Summe** | | **< 0,10 $** |

Also: vernachlässigbar. Brauchst nur einen Anthropic-API-Key mit ein paar Euro Guthaben.

## 6. Sicherheit & Datenschutz

- Supabase-Region **EU (Frankfurt)**.
- RLS auf jeder Tabelle, getestet mit einem Fremd-Account.
- Keine Geheimnisse im Frontend. Anthropic-Key, Google-Tokens, VAPID-Keys nur in Edge-Function-Secrets.
- Arzt-/Gesundheitsdaten: keine Diagnosen, nur Kontakt + Termine. Bewusst schlank halten.
- Dateien in privatem Storage-Bucket, Zugriff nur über signierte URLs.
- Backups: Supabase Free hat keine automatischen Backups mit Point-in-Time. → Wöchentlicher Export (GitHub Action, `pg_dump` in privates Repo oder Drive). Wichtig, weil hier echte Verträge drinstehen.

## 7. Aufwand (grob, mit Claude Code)

| Paket | Stunden |
|---|---|
| Setup (Repo, Supabase, Auth, PWA, Design-Grundgerüst, Deployment) | 6–8 |
| Todos inkl. wiederkehrend + Zuweisung | 6–8 |
| Einkaufsliste live | 4–5 |
| Verträge/Abos + Fixkosten-Übersicht + Fristberechnung | 7–9 |
| Push + tägliche Erinnerungen | 5–7 |
| Testen auf beiden Handys, Feinschliff | 4–5 |
| **MVP gesamt** | **~32–42** |
| Phase 2 (Rezepte, Ärzte, Geburtstage, Notfall, Kalender) | 25–35 |
| Phase 3 (KI, Safe, Export) | 20–30 |

"Stunden" heißt hier Arbeitszeit inkl. deiner Tests und Rückmeldungen, verteilt auf mehrere Sessions. Kalender und Push sind die Teile mit dem höchsten Risiko für Extrarunden (+30 % Puffer einplanen).

## 8. Was du einmalig einrichten musst

1. **Supabase-Account** + Projekt in Region Frankfurt anlegen (kostenlos). Ich brauche dann Projekt-URL und Keys als Secrets.
2. **Cloudflare- oder Vercel-Account** fürs Hosting (kostenlos, mit GitHub verbinden).
3. **Phase 2:** Google-Cloud-Projekt für die Kalender-API (ich schreibe dir eine Schritt-für-Schritt-Anleitung).
4. **Phase 3:** Anthropic-API-Key.

## 9. Offene Entscheidungen

1. **App-Name?** Arbeitstitel "Familien-App". Vorschläge: *Kleinekathöfer HQ*, *Zuhause*, *Wir2*. → Empfehlung: kurz und persönlich, z. B. "KK Home".
2. **Login:** a) Magic Link per Mail b) E-Mail + Passwort c) Google-Login → *Empfehlung c*, ihr habt beide Google-Konten (Annahme) und es passt zum Kalender.
3. **Hosting:** a) Cloudflare Pages b) Vercel → *Empfehlung a* (großzügiges Free Tier, kommerziell nutzbar, schnell in EU).
4. **Kalender in Phase 1 oder 2?** → *Empfehlung Phase 2*, weil OAuth-Setup das MVP sonst um ~1 Woche verzögert.
5. **Design:** ✅ Entschieden (23.11.): Variante A "Editorial hell" im Grün-Limette-Look (heller Grund #F3F6EF, Dunkelgrün #0F5D4C, Limette #C8F031, Mono-Labels in Versalien, Karten-Grid, Tab-Leiste unten: Heute · To-dos · [Mikro mittig] · Einkauf · Essen; farbige Icon-Felder in den Kacheln; Personenfarben Jannik blau, Irene orange; "Geld" und der Rest über "Mehr"). Mockups: https://claude.ai/artifact/V8DcphTCDkFofbYLWm9gR6
6. **Erinnerungszeiten:** Kündigung 30 + 7 Tage, Geburtstag 14 + 3 Tage, tägliche Zusammenfassung 7:00? → *Empfehlung: ja, später pro Person einstellbar.*

## 10. Nächste Schritte nach Freigabe

1. Repo-Grundgerüst (Vite + React + TS + PWA + Tailwind), CI, Deployment.
2. Supabase-Schema für Phase 1 als Migrations-Dateien + RLS-Tests.
3. Auth + Haushalt + Einladung.
4. Todos → Einkaufsliste → Verträge → Push, jeweils als eigener PR zum Testen.
