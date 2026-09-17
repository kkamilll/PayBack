# 💵 OddajTo / PayBack - Prosty Rejestr Długów i Rozliczeń

Prosta, przejrzysta i szybka aplikacja do kontrolowania rozliczeń ("kto, komu i ile wisi") z bazą danych SQLite oraz obsługą języka polskiego i angielskiego (🇵🇱 PL / 🇬🇧 EN).

---

## 🚀 Jak uruchomić aplikację? / How to run?

### 1. Wymagania / Requirements
- Zainstalowany [Node.js](https://nodejs.org/) (wersja 18 lub nowsza).

### 2. Uruchomienie krok po kroku / Step-by-step
W terminalu wpisz:

```bash
# 1. Instalacja zależności (jeśli robisz to pierwszy raz)
npm install

# 2. Start serwera
npm start
```

### 3. Otwórz w przeglądarce / Open in browser
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 💡 Główne Funkcje / Key Features

1. **Dwujęzyczność (🇵🇱 PL / 🇬🇧 EN)**:
   - Szybki przełącznik języka w prawym górnym rogu.
   - Zapamiętywanie wybranego języka w przeglądarce.

2. **Przycisk `+ Dodaj wpis` / `+ Add Entry`**:
   - Wygodne okno dodawania nowego rozliczenia.
   - Wybór kierunku: *Ktoś wisi mi* (🟢) lub *Ja wiszę komuś* (🔴).
   - Wpisz osobę, kwotę oraz opcjonalny powód.

3. **Dedykowane przyciski operacji / Action buttons**:
   - **`✓ Oddaj całość` / `✓ Settle all`**: błyskawiczne rozliczenie całej kwoty jednym kliknięciem.
   - **`Spłać część` / `Pay part`**: wpisanie częściowej kwoty (np. oddanie 50 zł z 200 zł).
   - **`📜 Historia` / `📜 History`**: podgląd wszystkich wcześniejszych spłat danej osoby wraz z datami i kwotami (oraz możliwością cofnięcia wpłaty).
   - **`Usuń` / `Delete`**: usunięcie wpisu z bazy.

4. **Bieżące podsumowanie / Live summary**:
   - *Wiszą Tobie* / *Owed to you* (zielony)
   - *Ty wisisz* / *You owe* (czerwony)
   - *Bilans* / *Net balance*

5. **Trwała baza danych SQLite**:
   - Wszystkie dane zapisują się automatycznie w pliku `data/oddaj.sqlite`.
