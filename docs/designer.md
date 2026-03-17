# Deck of Cats Designer Guide

This document defines the design principles and design-review standards for Deck of Cats.

It is not a replacement for [design.md](design.md).  
`design.md` explains the game itself.  
This file explains how design decisions for the game should be made and reviewed.

## Core

### Product direction

Deck of Cats should be designed as:

- a readable strategy game with short-to-medium runs;
- a mobile-first experience that still works well on desktop;
- a Poki-friendly web game with fast onboarding and minimal friction;
- a prototype that proves the core loop before expanding scope.

### Audience

The primary audience is:

- players who like accessible strategy and deckbuilding;
- players willing to make meaningful choices but not read a giant manual;
- players on web and mobile who need to understand the game quickly.

The game should not assume an expert audience from the first minute.

### Platform fit

Every design choice should respect the realities of web and Poki distribution:

- the game must become understandable quickly;
- early turns must be playable on small screens;
- sessions should deliver value even if the player leaves early;
- the first meaningful interaction must happen fast;
- complexity should grow through combinations and progression, not through overloaded controls.

### Core design principles

#### 1. Decision depth over rule volume

Interesting choices should come from:

- which pirates to send;
- which pirates stay on ship;
- how to spend scarce resources;
- what to buy for future hands;
- which route node to choose.

Depth should not come from forcing the player to memorize too many exceptions at once.

#### 2. Clear cause and effect

The player should usually understand:

- what action they took;
- what changed;
- why it changed;
- what that means for the next turn.

Resource gain, spending, boarding strength, and recruitment should stay legible.

#### 3. Early clarity, later richness

The first turns should teach the loop cleanly.
Later turns can become more combinatorial and demanding.

The tutorial and early runs should prioritize:

- clear island vs ship split;
- visible resource feedback;
- understandable shop value;
- understandable boarding pressure.

#### 4. Mobile readability is mandatory

Design must work on portrait mobile first.

That means:

- short labels;
- strong iconography;
- compact but readable effects;
- no dependence on hover-only understanding;
- important decisions must remain tappable and comprehensible on small screens.

#### 5. Randomness should create texture, not confusion

Random outcomes are acceptable when they:

- create replayability;
- produce interesting adaptation;
- are explained well enough for the player to trust the game.

Randomness is bad when it feels like silent betrayal or unreadable chaos.

#### 6. Long-term growth must feel earned

The game is a deckbuilder.
Buying pirates must feel like a meaningful long-term investment, not a cosmetic reward.

A good design change usually strengthens at least one of these:

- better deck shaping;
- new resource chains;
- stronger ship-building tradeoffs;
- better route planning;
- new late-run aspirations.

#### 7. Prototype discipline

This project is still a prototype.
Design should focus on:

- core loop quality;
- balance;
- readability;
- retention in the first few minutes;
- whether the run structure is compelling.

It should not get distracted by large secondary systems too early.

## Design lenses for this game

When proposing or reviewing a feature, evaluate it through these lenses:

### Loop fit

Does it improve this loop?

1. draw pirates;
2. choose island vs ship roles;
3. gain or convert resources;
4. buy stronger pirates;
5. prepare for boarding;
6. choose the next route.

### Poki fit

Does it help or hurt:

- click-to-understanding speed;
- first-session engagement;
- mobile playability;
- short-session satisfaction;
- replay value?

### Readability

Can the player explain the result of their action without outside help?

### Strategic value

Does the change create a real decision, or only add text and edge cases?

### Content scaling

If the idea is good, can it support more pirates, islands, or encounters later without collapsing into mess?

## Examples of good design directions

- a new pirate that creates a new but readable resource conversion line;
- an island modifier that changes decision pressure without changing the whole ruleset;
- a tutorial improvement that reduces confusion in the first three turns;
- a boarding-related mechanic that deepens preparation across several rounds.

## Examples of weak design directions

- adding complexity that only appears in rare edge cases and teaches nothing;
- adding content that is funny in isolation but does not strengthen the run structure;
- adding UI-heavy mechanics that are hard to use on mobile;
- adding randomness with no readable explanation or counterplay;
- adding meta systems before the core run is clearly fun.

## Review guidelines

Use this section as the checklist for design review.

### Core loop compliance

- Flag any feature that does not clearly strengthen the main run loop.
- Flag any mechanic that pulls attention away from island, ship, shop, map, or boarding decisions without a strong reason.
- Flag any addition that is interesting only on paper but not during an actual run.

### Platform and audience fit

- Flag designs that are too slow to understand for a Poki/web audience.
- Flag mechanics that require too much reading before the first interesting choice.
- Flag anything that depends on desktop-only affordances or precision that will not hold on mobile.

### Readability and feedback

- Flag mechanics whose outcomes are hard to explain from the player point of view.
- Flag hidden rule interactions unless they are intentionally rare and clearly signposted.
- Flag any design where the player cannot tell why they gained or lost resources, power, or tempo.

### Strategic quality

- Flag fake choice: two options that look different but lead to the same decision almost every time.
- Flag dominant strategies that obviously invalidate most of the pirate pool or most route choices.
- Flag mechanics that increase bookkeeping more than they increase meaningful planning.

### Balance and progression

- Flag new content that breaks the early, mid, or late-game curve.
- Flag additions that erase the tension between short-term weapons and long-term cannons.
- Flag shop, map, or pirate changes that make future deckbuilding decisions less meaningful instead of more meaningful.

### Tutorial and onboarding

- Flag any new mechanic that the player would need early but that is not teachable in the current onboarding structure.
- Flag anything that makes the first five turns noisier or more confusing.
- Flag tutorial text changes that explain UI instead of explaining decisions and outcomes.

### Prototype discipline

- Flag scope creep that does not help validate the core prototype.
- Flag expensive content ideas that should wait until the base game is proven.
- Flag "cool" mechanics that create implementation and balancing cost without improving retention, clarity, or decision depth.
