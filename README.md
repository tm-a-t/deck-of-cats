🇬🇧 English above  
🇷🇺 Русская версия ниже

Play at https://pirate-islands.netlify.app/.

---

## Deck of Cats

Browser deck-builder about pirate cats, built with Phaser 3.

### Current Build

- Sail a 40-layer branching map with 8 generated boarding fights; victory comes after the final ship on layer 39.
- Draw up to 5 pirates each turn from a 10-pirate starter crew; when the deck empties, the discard pile shuffles back in.
- On island turns, send up to 2 pirates ashore (3 on Port Island); pirates left on ship resolve ship actions in hand order.
- Ship actions produce `☠️`, personal weapons, and permanent buffs. Weapons and buffs stay on individual pirates until they leave the crew.
- Boarding is automatic 3-row combat against generated enemy parties. Defeated pirates become `🩹 Wounded`, sit out future boardings, and can be healed at Infirmary Island.
- The shop appears after island rounds with 4 slots. Bought pirates go to discard, purchase refills add one new slot, and `Continue` rotates the window.
- The menu includes `Play`, `Battle Test`, `Costumes`, `All Pirates`, and `Survey`; the main UI has route/goal hints, center island or combat, a fanned hand, `⏸` / `🗺️` / `🛒` buttons, and `Draw Pile` / `Discard` panels.

Full gameplay rules and the complete pirate list live in [rules.md](rules.md)._

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

- Плавание по ветвящейся карте на 40 слоёв с 8 сгенерированными абордажами; победа наступает после финального корабля на слое 39.
- Каждый ход вы тянете до 5 пиратов из стартовой команды на 10 карт; когда колода заканчивается, discard замешивается обратно.
- На островах можно отправить до 2 пиратов на берег (3 на Port Island); оставшиеся на корабле разыгрывают корабельные эффекты по порядку руки.
- Корабельные эффекты дают `☠️`, личное оружие и постоянные баффы. Оружие и баффы остаются на конкретном пирате, пока он не покинет команду.
- Абордаж теперь автоматический бой в 3 ряда против сгенерированной вражеской команды. Побеждённые пираты получают статус `🩹 Wounded`, пропускают будущие абордажи и могут лечиться на Infirmary Island.
- Магазин появляется после островов и всегда имеет 4 слота. Купленные пираты идут в discard, покупка сразу добавляет новый слот, а `Continue` сдвигает витрину.
- В меню есть `Play`, `Battle Test`, `Costumes`, `All Pirates` и `Survey`; основной интерфейс показывает подсказки маршрута и цели, остров или бой в центре, веер карт, кнопки `⏸` / `🗺️` / `🛒`, а также панели `Draw Pile` и `Discard`.

Полные правила и полный список пиратов находятся в [rules.md](rules.md).

### Локальный запуск

Сборки нет. Достаточно раздать корень репозитория любым статическим сервером, например:

```bash
python3 -m http.server 8000
```

После этого откройте `http://localhost:8000`.

### Примечание

Баланс и контент ещё меняются. Особенно полезен фидбек по балансу, темпу игры и новым пиратам.
