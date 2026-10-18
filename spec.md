# Three.js Fishing Game — Implementation Spec

## Stack

* HTML5
* CSS3
* Vanilla JavaScript
* Bootstrap 5 via CDN
* Three.js via CDN
* No PHP, backend, database, or build tools

## Files

| File         | Purpose                                            |
| ------------ | -------------------------------------------------- |
| `index.html` | Page structure, Bootstrap UI, Three.js canvas      |
| `style.css`  | Game HUD, responsive layout, animations            |
| `app.js`     | Rendering, fish AI, casting, catching, progression |

All files remain in the same directory.

## Game Concept

A stationary first-person fishing game. The player remains on a dock and repeatedly casts into a lake.

Core loop:

1. Select bait.
2. Aim the cast.
3. Hold to set casting power.
4. Wait for a bite.
5. Complete a reaction and tension minigame.
6. Catch or lose the fish.
7. Review fish stats and earn coins.

## Three.js Scene

Include:

* Stylized lake with animated water
* Wooden dock
* Fishing rod and line
* Bobber
* Distant trees, rocks, clouds, and mountains
* Directional sunlight, fog, and shadows
* Underwater fish silhouettes
* Day-to-evening color transition

Use simple low-poly geometry for consistent performance.

## Fishing Mechanics

### Casting

* Horizontal aim meter
* Hold-to-charge power meter
* Cast distance affects available fish
* Poor timing creates shorter or inaccurate casts

### Bite Phase

Each fish has:

* Bite delay
* Bite window
* Fake-bite chance
* Preferred bait
* Preferred water depth

The player must click during the valid bite window.

### Reeling Minigame

Display:

* Fish stamina
* Line tension
* Reel progress
* Safe tension zone

Player holds the reel control to pull the fish closer.

* Excess tension breaks the line
* Low tension allows escape progress
* Fish occasionally dashes or changes direction
* Larger fish require longer fights

## Fish Stats

Each species defines:

| Stat            | Effect                       |
| --------------- | ---------------------------- |
| Rarity          | Spawn probability and reward |
| Weight Range    | Final catch size             |
| Strength        | Tension generated            |
| Stamina         | Fight duration               |
| Speed           | Frequency of sudden movement |
| Bite Difficulty | Reaction window              |
| Preferred Bait  | Catch probability            |
| Value           | Coins awarded                |

Example species:

| Fish         | Rarity    | Strength | Stamina | Value |
| ------------ | --------- | -------: | ------: | ----: |
| Bluegill     | Common    |        2 |       2 |    10 |
| Bass         | Uncommon  |        5 |       5 |    35 |
| Catfish      | Rare      |        7 |       8 |    80 |
| Golden Koi   | Epic      |        6 |       7 |   180 |
| Lake Monster | Legendary |       10 |      10 |   500 |

## Catch Result UI

After each catch, show a Bootstrap modal containing:

* Fish name
* 3D fish preview
* Rarity badge
* Weight
* Length
* Strength
* Stamina
* Personal-best indicator
* Coin reward
* Keep or release buttons

## Progression

Store progress using `localStorage`.

Track:

* Coins
* Fish caught
* Personal records
* Species collection
* Current bait
* Rod upgrades
* Line upgrades

Suggested upgrades:

* Better rod: faster reel progress
* Stronger line: higher tension limit
* Improved reel: lower stamina loss
* Better bait: increased rare-fish chance

## Interface Layout

### Top Bar

* Coins
* Current bait
* Weather
* Time of day
* Settings

### Left Panel

* Fish collection
* Recent catches
* Personal records

### Bottom Controls

* Aim indicator
* Power meter
* Cast button
* Reel button
* Tension meter

### Right Panel

* Current fish name, once identified
* Strength
* Stamina
* Estimated size
* Rarity

## Visual Style

* Rounded translucent HUD panels
* Blue and teal lake palette
* Bright rarity colors
* Soft shadows and glass-style overlays
* Animated water ripples around the bobber
* Camera shake during strong fish pulls
* Particle splashes during bites and catches

## Completion Criteria

* Player can aim and cast.
* Fish spawn using weighted rarity.
* Bites use reaction timing.
* Reeling uses stamina and tension.
* Different fish behave according to their stats.
* Catch results display full fish information.
* Coins and records persist locally.
* UI works on desktop and mobile.