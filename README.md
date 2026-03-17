🇬🇧 English above  
🇷🇺 Русская версия ниже

Play at https://pirate-islands.netlify.app/.

---

## Deck of Cats

Browser deck-builder about pirate cats, built with Phaser 3.

### Current Build

- Sail a 50-layer branching map with 10 boarding fights.
- Draw up to 5 pirates each turn.
- On island turns, send up to 2 pirates ashore (3 on Port Island); pirates left on ship resolve ship actions.
- On boarding turns, total strength = crew strength + 🗡️ weapons + 💣 cannons.
- The shop has 4 slots; bought pirates go into the deck; the shop rotates at the end of shopping.
- The redesigned wood-and-parchment UI keeps strength and the current goal in the header, the island or ship in the center, a fan hand at the bottom, `🗺️` and `🛒` in the top-right, and `Draw Pile` / `Discard` panels in the footer.

Full gameplay rules and the complete pirate list live in [rules.md](rules.md).

### Local Run

No build step. Serve the repo root with any static file server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

### Notes

Balance and content are still being adjusted. Feedback on balance, pacing, and pirate design is useful.

---

## Deck of Cats

Браузерный декбилдер про пиратских котов на Phaser 3.

### Текущая версия

- Плавание по ветвящейся карте на 50 слоёв с 10 абордажами.
- Каждый ход вы тянете до 5 пиратов.
- На островах можно отправить до 2 пиратов на берег (3 на Port Island); оставшиеся на корабле разыгрывают корабельные эффекты.
- В абордаже общая сила = сила команды + 🗡️ оружие + 💣 пушки.
- В магазине 4 слота; купленные пираты идут в колоду; в конце шопинга витрина сдвигается.
- В обновлённом деревянно-пергаментном интерфейсе сверху показаны сила и текущая цель, в центре остров или вражеский корабль, снизу веер карт, справа сверху `🗺️` и `🛒`, а в футере панели `Draw Pile` и `Discard`.

Полные правила и полный список пиратов находятся в [rules.md](rules.md).

### Локальный запуск

Сборки нет. Достаточно раздать корень репозитория любым статическим сервером, например:

```bash
python3 -m http.server 8000
```

После этого откройте `http://localhost:8000`.

### Примечание

Баланс и контент ещё меняются. Особенно полезен фидбек по балансу, темпу игры и новым пиратам.
