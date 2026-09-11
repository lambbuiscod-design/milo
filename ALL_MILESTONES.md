<USER_REQUEST>
/goal /teamwork-preview /grill-me /browser Yes. Build these **14 features only**, and make them **100% local so none of them creates API bills**:

**1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 18, 19, 21, 23.**

Below is the end-to-end implementation specification I would give Codex for Milo.

---

# MILO V2 — END-TO-END IMPLEMENTATION PLAN

## 0. Non-negotiable rule

Before Codex changes anything, add this rule to the project:

> **Milo must NEVER call an AI API, vision API, speech API, cloud inference API, or external paid API for animations, reactions, emotions, idle behavior, personality appearance, XP, progression, room, customization, desktop movement, privacy UI, themes, or settings. These features must run locally.**

For these 14 features:

```text
OpenAI API         = NO
Anthropic API      = NO
Gemini API         = NO
Vision API         = NO
Speech API         = NO
Cloud database     = NO requirement
Cloud AI           = NO
```

Everything we are implementing should be:

```text
User action
     ↓
Local event
     ↓
Local Milo engine
     ↓
Animation / UI
```

Not:

```text
User action
     ↓
Internet API
     ↓
AI
     ↓
Animation
```

---

# 1. Features being implemented

Only implement:

| #  | Feature                                        |
| -- | ---------------------------------------------- |
| 1  | Animated Milo + personality                    |
| 2  | Desktop Milo outside circular container        |
| 3  | Click, hover, drag, drop interactions          |
| 4  | Simplified main UI                             |
| 5  | Milo Home                                      |
| 6  | Personality affects Milo visually/behaviorally |
| 10 | XP / friendship / progression                  |
| 11 | Milo Room                                      |
| 12 | Deep Milo customization                        |
| 13 | Milo reactions                                 |
| 18 | Privacy UI / Milo's Eyes                       |
| 19 | New visual design/colors                       |
| 21 | Dedicated Settings                             |
| 23 | Idle behaviors                                 |

The original Milo concept specifically puts the animated character at the center instead of treating him as a logo inside a launcher. 

---

# 2. DO NOT implement these now

Codex should NOT add:

```text
❌ AI voice
❌ Voice transcription
❌ Screenshot AI analysis
❌ Explain this
❌ Write reply
❌ AI coding assistant
❌ Conversation analysis
❌ Continuous background AI analysis
❌ AI-generated reactions
❌ Chat AI modifications
❌ Online accounts
❌ Cloud sync
❌ Mini games
❌ Activities
❌ Study mode
❌ Wingman
❌ Seasonal content
❌ Onboarding overhaul
```

Do not scope-creep.

---

# 3. First thing Codex should do

Before writing code, Codex must inspect the current repository.

It should identify:

```text
framework
package manager
desktop framework
current window management
state management
current settings storage
existing Milo assets
current screens
existing privacy implementation
existing CSS/theme system
existing animations
existing build scripts
```

Then it should **modify the existing project**.

Do NOT rewrite Milo from zero unless the existing architecture absolutely requires it.

---

# 4. Target architecture

The final application should have these major systems:

```text
MILO
│
├── Core
│   ├── Event Bus
│   ├── State Manager
│   └── Local Storage
│
├── Character Engine
│   ├── Milo State Machine
│   ├── Animation Manager
│   ├── Emotion Manager
│   ├── Reaction Manager
│   ├── Personality Manager
│   └── Idle Manager
│
├── Desktop Companion
│   ├── Transparent Window
│   ├── Drag Controller
│   ├── Cursor Tracking
│   ├── Screen Bounds
│   └── Position Persistence
│
├── Main Application
│   ├── Home
│   ├── Milo Room
│   ├── Customize
│   └── Settings
│
├── Progression
│   ├── XP
│   ├── Levels
│   ├── Streaks
│   └── Unlocks
│
├── Customization
│   ├── Fur
│   ├── Eyes
│   ├── Clothing
│   ├── Accessories
│   └── Animation Personality
│
├── Privacy
│   ├── Milo Eyes
│   └── Actual Permission State
│
└── Design System
    ├── Colors
    ├── Typography
    ├── Spacing
    ├── Buttons
    ├── Cards
    └── Motion
```

---

# 5. Recommended source structure

Codex can adapt this to your existing repo.

```text
src/
│
├── core/
│   ├── events/
│   │   ├── eventBus.ts
│   │   └── eventTypes.ts
│   │
│   └── storage/
│       ├── storage.ts
│       ├── defaults.ts
│       ├── schema.ts
│       └── migrations.ts
│
├── milo/
│   ├── character/
│   │   ├── MiloCharacter.tsx
│   │   ├── MiloRenderer.tsx
│   │   └── MiloLayers.tsx
│   │
│   ├── state/
│   │   ├── miloState.ts
│   │   ├── MiloStateMachine.ts
│   │   └── priorities.ts
│   │
│   ├── animations/
│   │   ├── AnimationManager.ts
│   │   ├── animationRegistry.ts
│   │   └── animationTypes.ts
│   │
│   ├── emotions/
│   │   ├── EmotionManager.ts
│   │   └── emotions.ts
│   │
│   ├── reactions/
│   │   ├── ReactionManager.ts
│   │   └── reactions.ts
│   │
│   ├── personality/
│   │   ├── PersonalityManager.ts
│   │   └── personalities.ts
│   │
│   └── idle/
│       ├── IdleManager.ts
│       └── idleBehaviors.ts
│
├── companion/
│   ├── CompanionWindow.tsx
│   ├── DragController.ts
│   ├── CursorTracker.ts
│   ├── ScreenBounds.ts
│   └── PositionManager.ts
│
├── progression/
│   ├── XPManager.ts
│   ├── LevelManager.ts
│   ├── StreakManager.ts
│   ├── UnlockManager.ts
│   └── rewards.ts
│
├── customization/
│   ├── AppearanceManager.ts
│   ├── cosmetics.ts
│   └── CosmeticRenderer.tsx
│
├── room/
│   ├── MiloRoom.tsx
│   ├── RoomRenderer.tsx
│   ├── RoomEditor.tsx
│   ├── RoomItem.tsx
│   └── roomItems.ts
│
├── privacy/
│   ├── PrivacyManager.ts
│   ├── MiloEyes.tsx
│   └── privacyTypes.ts
│
├── pages/
│   ├── Home/
│   ├── Customize/
│   ├── Room/
│   └── Settings/
│
└── design/
    ├── tokens.css
    ├── typography.css
    ├── motion.css
    └── components/
```

---

# PHASE 1 — DESIGN SYSTEM

Do this **before redesigning screens**.

## 6. Global color system

Use:

```css
:root {
  --bg-primary: #10131F;
  --bg-surface: #181D2D;
  --bg-elevated: #232A40;

  --milo-coral: #FF8066;
  --milo-peach: #FFAE8F;
  --milo-purple: #886CFF;
  --milo-mint: #60E6BD;

  --text-primary: #F7F8FC;
  --text-secondary: #9CA5BC;

  --danger: #FF5D6C;

  --radius-small: 8px;
  --radius-medium: 14px;
  --radius-large: 20px;
}
```

These are based on the direction already proposed for Milo. 

---

# 7. Color usage

Don't make everything colorful.

### Coral

Use for:

```text
primary actions
Milo
emotional actions
important buttons
```

### Purple

Use for:

```text
customization
personality
special items
```

### Mint

Use for:

```text
privacy
local processing
safe state
successful status
```

### Red

Only:

```text
errors
danger
destructive actions
```

---

# 8. Typography

Create consistent typography:

```text
H1
30px / 700

H2
22px / 650

H3
18px / 600

Body
15px / 400

Small
13px / 400

Micro
11-12px
```

---

# 9. Reduce excessive cards

Current Milo should stop looking like:

```text
┌───────────────┐
│ ┌───────────┐ │
│ │   Card    │ │
│ └───────────┘ │
└───────────────┘
```

Use whitespace.

The previous concept similarly recommends removing many unnecessary outer containers. 

---

# PHASE 2 — MILO CHARACTER ENGINE

This is the **most important engineering phase**.

Everything else depends on this.

---

# 10. Milo state types

Create:

```ts
export type MiloState =
  | "idle"
  | "looking"
  | "walking"
  | "sleepy"
  | "sleeping"
  | "waking"
  | "thinking"
  | "happy"
  | "laughing"
  | "surprised"
  | "confident"
  | "celebrating"
  | "annoyed"
  | "embarrassed"
  | "affectionate"
  | "working"
  | "pickedUp"
  | "dragging"
  | "dropping";
```

The design originally calls for exactly this sort of broad animated state system. 

---

# 11. State manager

Never call individual animation assets throughout random UI components.

BAD:

```ts
play("/assets/milo/happy.webm");
```

GOOD:

```ts
milo.setState("happy");
```

Then:

```text
UI
 ↓
MiloStateMachine
 ↓
AnimationManager
 ↓
Renderer
```

---

# 12. Animation registry

Create one registry:

```ts
const animations = {
  idle: {...},
  blink: {...},
  sleep: {...},
  stretch: {...},
  happy: {...},
  laugh: {...},
  surprised: {...},
  annoyed: {...},
  drag: {...},
  drop: {...},
  celebrate: {...}
};
```

This makes adding animations easy.

---

# 13. Animation priority system

Extremely important.

Use something like:

```text
100 dragging
90  critical transition
80  level celebration
70  user reaction
60  click interaction
40  hover
20  idle behavior
0   basic idle
```

If Milo is being dragged:

```text
sleep animation
```

must NOT suddenly start.

---

# 14. Animation manager

Conceptually:

```ts
animationManager.play({
  id: "laugh",
  priority: 70,
  interruptible: true,
  returnState: "idle"
});
```

---

# 15. Minimum initial animations

Don't start with 50.

Implement:

```text
idle
blink
look-left
look-right
happy
laugh
surprised
annoyed
stretch
yawn
sleep
wake
pick-up
drag
drop
bounce
celebrate
```

Then expand.

---

# 16. Milo rendering architecture

Use layered Milo assets.

```text
              accessory-head
                    ↓
                   hat

             accessory-face
                    ↓
                 glasses

              eye layer
                    ↓

              base body
                    ↓

             clothing layer
                    ↓

               fur layer
```

Do not render every combination as a completely separate Milo.

---

# PHASE 3 — DESKTOP COMPANION

Feature #2.

Milo needs to exist outside the main window.

The concept explicitly proposes a compact draggable desktop companion. 

---

# 17. Companion window requirements

The companion window should be:

```text
transparent
frameless
small
resizable only internally if necessary
optional always-on-top
no taskbar entry if your framework supports it
clickable only around Milo
draggable through Milo
```

If Electron:

```text
BrowserWindow
transparent: true
frame: false
alwaysOnTop
skipTaskbar
```

If Tauri:

```text
WebviewWindow
transparent
decorations false
alwaysOnTop
```

Use whichever framework Milo already uses.

Do NOT rewrite frameworks just for this.

---

# 18. Companion size

Example:

```text
width: 180–250px
height: 220–300px
```

But transparent.

The user visually sees only Milo.

---

# 19. Save position

Save:

```ts
interface CompanionPosition {
  x: number;
  y: number;
  monitorId?: string;
}
```

When Milo moves:

```text
drag
 ↓
position change
 ↓
debounce
 ↓
save locally
```

Restart application:

```text
load position
 ↓
validate monitor exists
 ↓
restore Milo
```

---

# 20. Multi-monitor handling

If the user disconnects a monitor:

```text
saved monitor missing
        ↓
detect primary monitor
        ↓
move Milo safely to primary
```

Prevent Milo becoming permanently inaccessible.

---

# 21. Screen bounds

Milo should never become completely hidden.

Allow perhaps:

```text
10–25px edge peek
```

but don't let all of Milo leave the screen.

---

# PHASE 4 — INTERACTIONS

Feature #3.

---

# 22. Single click

Single click Milo:

```text
        /\_/\
       ( •ᴗ• )

   ┌──────────────┐
   │ Open Milo    │
   │ Milo Room    │
   │ Customize    │
   │ Settings     │
   │ Hide Milo    │
   └──────────────┘
```

No AI actions.

No API.

---

# 23. Double click

Double click:

```text
random harmless animation
```

Possible:

```text
wave
jump
spin
happy
surprised
tiny dance
```

Add cooldown:

```text
1–2 seconds
```

to prevent event spam.

---

# 24. Hover

Milo's eyes follow the pointer slightly.

Do not move his entire face aggressively.

Calculate:

```text
cursorX - MiloCenterX
cursorY - MiloCenterY
```

Normalize direction.

Maximum pupil movement:

```text
approximately 3–5px
```

---

# 25. Drag

Flow:

```text
mousedown
   ↓
hold threshold
   ↓
pickedUp
   ↓
dragging
   ↓
move window
```

While dragging:

```text
feet lift
body stretches slightly
eyes react
```

---

# 26. Drop

Flow:

```text
mouse release
 ↓
drop animation
 ↓
squash
 ↓
bounce
 ↓
idle
```

This detail will make Milo feel far more polished.

---

# PHASE 5 — IDLE BEHAVIOR ENGINE

Feature #23.

The source proposes behaviors like paw cleaning, yawning, stretching, coffee, reading and sleeping, but specifically says they should not happen constantly. 

---

# 27. Idle manager

Track:

```ts
lastUserInteraction
lastMiloAnimation
currentIdleDuration
lastIdleBehavior
```

---

# 28. Idle intervals

Example:

### 0–2 min

```text
blink
look around
normal idle
```

### 2–5 min

Possible:

```text
stretch
clean paws
look around
```

### 5–10 min

Possible:

```text
coffee
read
small toy
```

### 10–15 min

```text
yawn
sleepy
```

### 15+ min

```text
sleep
```

Do not hard-code exactly the same sequence every time.

---

# 29. Weighted random system

Example:

```ts
{
  id: "stretch",
  weight: 25,
  cooldown: 300000
}
```

Another:

```ts
{
  id: "coffee",
  weight: 8,
  cooldown: 900000
}
```

Rare behaviors should feel special.

---

# 30. Wake behavior

When Milo sleeps and user interacts:

```text
cursor enters
or click
or drag
        ↓
wake animation
        ↓
stretch
        ↓
idle
```

---

# PHASE 6 — REACTION SYSTEM

Feature #13.

Reactions must be local.

The original design specifically says Milo does not always need another text bubble; sometimes an emotional reaction alone is enough. 

---

# 31. Reaction types

```ts
export type MiloReaction =
  | "love"
  | "laugh"
  | "happy"
  | "confused"
  | "surprised"
  | "annoyed"
  | "proud"
  | "sleepy";
```

---

# 32. Reaction triggers

Local triggers only.

Example:

```text
Double click
→ surprised

Level up
→ celebrate

Unlock cosmetic
→ happy

Open room
→ happy

Drag Milo too much
→ annoyed

Return after sleep
→ happy

Change outfit
→ inspect outfit / proud
```

---

# 33. Do NOT do this

```text
read user screen
 ↓
send screenshot to AI
 ↓
AI identifies emotion
 ↓
reaction
```

That costs money.

Not part of this release.

---

# PHASE 7 — HOME REDESIGN

Features #4 + #5.

The old utility/settings feeling should disappear.

The Home proposal in your Milo design is explicitly intended to make the application feel like a companion product rather than another configuration dashboard. 

---

# 34. New Home screen

Use something like:

```text
╭────────────────────────────────────────────╮
│ Milo                                  ⚙   │
│                                            │
│                  ✦                         │
│               /\___/\                      │
│              ( ^ ᴗ ^ )                     │
│                                            │
│             Welcome back!                  │
│                                            │
│         [ Open Desktop Milo ]              │
│                                            │
│       Milo Room       Customize            │
│                                            │
│ ❤️ Friendship Lv. 7          🔥 4 days    │
│                                            │
│ 🛡 Milo's Eyes                             │
│ Selected window only                       │
│                                            │
╰────────────────────────────────────────────╯
```

---

# 35. Home should contain

```text
Animated Milo
Greeting
Companion launch/hide
Relationship level
Streak
Milo Room
Customize
Privacy summary
Settings shortcut
```

---

# 36. Home should NOT contain

```text
volume slider
opacity slider
always on top
technical privacy description
theme editor
motion settings
all app configuration
```

Those belong under Settings.

---

# PHASE 8 — SETTINGS

Feature #21.

The original plan also explicitly recommends moving configuration such as volume, opacity, docking, motion and privacy into an actual Settings screen. 

---

# 37. Settings navigation

Create:

```text
Settings

General
Milo
Sound
Display
Companion
Privacy
Data
```

---

# 38. General

```text
Start Milo with computer
Start minimized
Language
Close behavior
```

---

# 39. Milo

```text
Personality
Animation personality
Idle animations
Idle animation frequency
```

---

# 40. Sound

```text
Master volume
Milo sound effects
Interface sounds
Mute Milo
```

All sound assets local.

---

# 41. Display

```text
Theme
Motion level
UI scale if needed
```

---

# 42. Companion

```text
Always on top
Opacity
Docking
Restore last position
Allow edge peek
```

---

# 43. Privacy

Show existing privacy controls here.

Don't create fake permissions.

---

# 44. Data

```text
Export Milo settings
Reset appearance
Reset room
Reset progress
Reset everything
```

Require confirmation for destructive reset.

---

# PHASE 9 — PRIVACY / MILO'S EYES

Feature #18.

The privacy concept already gives Milo a distinctive visual framing: show exactly what Milo can currently see rather than giant technical paragraphs. 

---

# 45. Home privacy widget

Show:

```text
🛡 Milo's Eyes

Selected window only
```

or:

```text
🛡 Milo's Eyes

Nothing selected
```

depending on actual state.

---

# 46. Expanded privacy view

```text
What Milo can see

✓ Selected window
✕ Other windows
✕ Desktop
✕ Password fields

Processing
● On device

Selected:
Visual Studio Code
```

Again:

**only show values that your app actually enforces.**

---

# 47. Privacy data model

```ts
interface PrivacyState {
  selectedWindowName?: string;

  selectedWindowVisible: boolean;
  otherWindowsVisible: boolean;
  desktopVisible: boolean;
  passwordFieldsBlocked: boolean;

  processingMode: "local";
}
```

---

# PHASE 10 — PERSONALITIES

Feature #6.

Personality changes behavior and visuals.

No AI.

---

# 48. Initial personalities

Start with four.

## Friend Milo

```text
friendly
energetic
more smiles
more waving
```

## Flirty Milo

```text
confident
occasional wink
blush expression
```

## Sarcastic Milo

```text
smirk
eye roll
lower animation energy
```

## Professional Milo

```text
calm
focused
coffee
tiny tie optional
```

The source already proposes these personality-to-visual transformations. 

---

# 49. Personality configuration

```ts
interface PersonalityDefinition {
  id: string;
  name: string;

  animationSpeed: number;
  animationEnergy: number;

  idleWeights: Record<string, number>;

  defaultExpression: string;

  themeAccent: string;

  optionalAccessories: string[];
}
```

---

# 50. Don't duplicate every asset

Do not create:

```text
friend_walk
professional_walk
sarcastic_walk
flirty_walk
```

unless visually necessary.

Instead:

```text
walk animation
+
different speed
+
different expression
+
different accessory
```

---

# PHASE 11 — CUSTOMIZATION

Feature #12.

The earlier proposal specifically expands customization from four basic colors to fur, eyes, accessories, clothing, room and animation personality. 

---

# 51. Customize screen

Navigation:

```text
MILO

Appearance
Clothes
Accessories
Animation
```

Large real-time preview in center.

---

# 52. First release content

Do not make hundreds of assets immediately.

Start:

### Fur

```text
4–6
```

### Eyes

```text
3–4
```

### Hats

```text
4
```

### Glasses

```text
3
```

### Clothes

```text
4
```

### Scarves/accessories

```text
3–5
```

### Animation personalities

```text
Calm
Energetic
Chaotic
Sleepy
```

---

# 53. Appearance structure

```ts
interface MiloAppearance {
  fur: string;
  eyes: string;

  clothing?: string;

  accessories: {
    head?: string;
    face?: string;
    neck?: string;
    body?: string;
  };

  animationPersonality:
    | "calm"
    | "energetic"
    | "chaotic"
    | "sleepy";
}
```

---

# 54. Live preview

When user selects sunglasses:

```text
click sunglasses
      ↓
preview immediately
      ↓
don't save yet
```

Click:

```text
Save
```

then persist.

---

# PHASE 12 — XP / FRIENDSHIP / LEVELS

Feature #10.

The progression concept explicitly recommends cosmetic/fun progression rather than locking important capabilities. 

---

# 55. Progress structure

```ts
interface MiloProgress {
  xp: number;
  level: number;

  firstMetAt: string;

  currentStreak: number;
  longestStreak: number;

  lastActiveDate?: string;

  totalInteractions: number;

  unlockedItems: string[];
}
```

---

# 56. XP events

Example:

| Action               |  XP |
| -------------------- | --: |
| First app open today | +10 |
| Interact with Milo   |  +1 |
| Customize Milo       |  +2 |
| Open room            |  +2 |
| Change personality   |  +2 |
| Daily streak         |  +5 |

---

# 57. Prevent XP spam

Important.

Interaction XP:

```text
maximum 10 XP/day
```

Changing outfit:

```text
maximum 2–5 XP/day
```

Otherwise:

```text
click click click click
```

could generate infinite XP.

---

# 58. Level system

Use a simple formula.

For example:

```ts
xpRequiredForNextLevel =
  100 + ((level - 1) * 50);
```

---

# 59. Example

```text
Level 1 → 100
Level 2 → 150
Level 3 → 200
Level 4 → 250
Level 5 → 300
```

---

# 60. Unlocks

Example:

```text
Level 2
Happy reaction

Level 3
Beanie

Level 4
Round glasses

Level 5
Night room background

Level 7
Desk

Level 8
Sunglasses

Level 10
Special celebration

Level 12
Gaming outfit

Level 15
Rare idle animation

Level 20
Premium-looking room theme
```

But all unlocks are local assets.

No payments required.

---

# 61. Level-up experience

When level increases:

```text
        ✨      ✨

          /\_/\
         ( ^ᴗ^ )
         /     \

       LEVEL 8

Unlocked:
😎 Sunglasses
```

Milo:

```text
jump
confetti
happy
```

Return to idle.

---

# PHASE 13 — MILO ROOM

Feature #11.

The room is meant to turn Milo from an icon into a small digital companion with an environment. 

---

# 62. Room screen

```text
╭────────────────────────────────────────────╮
│ Milo's Room                         Edit   │
│                                            │
│               🖼                            │
│                                            │
│      🪴                  /\_/\              │
│                         ( ^.^ )             │
│             🛋            ☕                │
│                                            │
│                   rug                      │
│                                            │
╰────────────────────────────────────────────╯
```

---

# 63. Room layers

Use:

```text
Background
    ↓
Wall
    ↓
Furniture back
    ↓
Milo
    ↓
Furniture front
    ↓
Effects
```

---

# 64. Initial room items

Start with:

```text
bed
desk
chair
lamp
plant
poster
rug
computer
couch
toy
```

The source already suggests this style of unlockable room object. 

---

# 65. Room item structure

```ts
interface RoomItem {
  id: string;
  category:
    | "furniture"
    | "wall"
    | "floor"
    | "decoration";

  position: {
    x: number;
    y: number;
  };

  scale: number;
  rotation: number;

  unlocked: boolean;

  levelRequirement?: number;
}
```

---

# 66. Room editor

Edit mode:

```text
drag item
rotate item
remove item
place item
change background
```

Then:

```text
Save Room
```

---

# 67. Snap system

Don't require pixel-perfect placement.

Use a basic grid:

```text
8px
or
12px
```

Optional invisible snap.

---

# 68. Room persistence

Store:

```json
{
  "background": "room_dark_01",
  "items": [
    {
      "id": "plant_01",
      "x": 120,
      "y": 320,
      "scale": 1
    }
  ]
}
```

---

# PHASE 14 — LOCAL STORAGE

Everything should survive restart.

---

# 69. Milo save data

Create a versioned structure:

```ts
interface MiloSaveData {
  version: number;

  appearance: MiloAppearance;

  personality: string;

  progress: MiloProgress;

  companion: {
    x: number;
    y: number;
    monitorId?: string;
  };

  room: RoomState;

  settings: MiloSettings;
}
```

---

# 70. Version data

Very important.

```json
{
  "version": 1
}
```

Later when you change schemas:

```text
v1
 ↓
migration
 ↓
v2
```

Otherwise old Milo installations can break.

---

# 71. Storage choice

For this feature set:

### Good first option

```text
local JSON
```

or your desktop framework's secure persistent store.

Later:

```text
SQLite
```

if the amount of structured data grows.

You do NOT need:

```text
Firebase
Supabase
MongoDB Atlas
AWS database
```

for these features.

---

# PHASE 15 — EVENT BUS

This will make Milo significantly easier to maintain.

---

# 72. Events

Create:

```ts
export type MiloEvent =
  | "APP_OPENED"
  | "MILO_CLICKED"
  | "MILO_DOUBLE_CLICKED"
  | "MILO_HOVERED"
  | "MILO_DRAG_STARTED"
  | "MILO_DRAGGED"
  | "MILO_DROPPED"
  | "USER_IDLE"
  | "USER_RETURNED"
  | "ROOM_OPENED"
  | "COSMETIC_CHANGED"
  | "PERSONALITY_CHANGED"
  | "XP_GAINED"
  | "LEVEL_UP"
  | "ITEM_UNLOCKED";
```

---

# 73. Example

```text
ITEM_UNLOCKED
      ↓
UnlockManager
      ↓
Inventory updated
      ↓
ReactionManager
      ↓
Milo happy
      ↓
UI notification
```

---

# PHASE 16 — MOTION SETTINGS

Because Milo moves a lot, provide:

```text
Full
Reduced
Minimal
```

### Full

All animations.

### Reduced

```text
no long walking
smaller bounce
fewer idle actions
```

### Minimal

```text
blink
eyes
small expression changes
```

---

# PHASE 17 — PERFORMANCE

Very important for a desktop companion.

Milo must NOT use 20% CPU just because a cat is blinking.

---

# 74. Performance rules

When idle:

```text
minimal rendering
```

When sleeping:

```text
almost no rendering
```

When invisible:

```text
pause animation loops
```

When main app minimized:

```text
stop unnecessary screen rendering
```

Avoid:

```text
setInterval(..., 10)
```

running everywhere.

Prefer:

```text
requestAnimationFrame
```

only when animation actually needs it.

---

# 75. Asset caching

Load common animations once.

Cache:

```text
idle
blink
drag
sleep
wake
```

Lazy-load uncommon:

```text
special celebration
rare room animations
rare reactions
```

---

# PHASE 18 — SECURITY / PRIVACY

No network request should happen from these features.

Codex should search the codebase for:

```text
fetch(
axios
OpenAI
Anthropic
Gemini
WebSocket
HTTP
```

and ensure none of the new modules call them.

---

# 76. Add API guardrail

For development, create a simple rule:

```text
milo/
progression/
customization/
room/
companion/
```

must not import your AI/network layer.

For example:

```text
❌ room → aiClient
❌ idle → aiClient
❌ reactions → aiClient
❌ progression → aiClient
```

---

# PHASE 19 — TESTING

Do not just visually test it.

---

# 77. State machine tests

Test:

```text
idle → happy
idle → sleeping
sleeping → waking
waking → idle
idle → dragging
dragging → drop
drop → idle
```

---

# 78. Priority tests

Example:

```text
idle animation active
↓
user drags Milo
↓
idle is immediately interrupted
↓
drag takes priority
```

---

# 79. Persistence tests

Change:

```text
fur
outfit
personality
room
position
XP
settings
```

Restart Milo.

Everything must remain.

---

# 80. Multi-monitor tests

Test:

```text
monitor 1
monitor 2
move Milo
disconnect monitor 2
restart
```

Milo must remain accessible.

---

# 81. XP tests

Make sure:

```text
XP cannot be farmed infinitely
level calculation works
rewards unlock exactly once
restart doesn't unlock again
```

---

# 82. Room tests

Test:

```text
place object
move
delete
save
restart
```

Layout must remain.

---

# 83. Settings tests

Each setting should:

```text
change real behavior
save
restore
```

No fake toggles.

---

# 84. Privacy tests

UI must always represent actual state.

For example:

```text
no window selected
```

must show:

```text
Nothing selected
```

not:

```text
✓ ChatGPT
```

---

# PHASE 20 — IMPLEMENTATION ORDER FOR CODEX

Tell Codex to implement in this exact order.

## Milestone 1

```text
Project audit
Design tokens
Reusable UI primitives
```

## Milestone 2

```text
Milo state machine
Animation manager
Animation priorities
Basic Milo renderer
```

## Milestone 3

```text
Transparent companion window
Position persistence
Screen bounds
Multi-monitor recovery
```

## Milestone 4

```text
Hover
cursor eyes
single click
double click
drag
drop
bounce
```

## Milestone 5

```text
Idle manager
sleep
wake
random behaviors
```

## Milestone 6

```text
Reaction manager
local triggers
```

## Milestone 7

```text
Home redesign
remove setting clutter
```

## Milestone 8

```text
Dedicated Settings
```

## Milestone 9

```text
Milo's Eyes privacy UI
```

## Milestone 10

```text
Personality system
```

## Milestone 11

```text
Customization engine
layered cosmetics
preview
saving
```

## Milestone 12

```text
XP
levels
streak
unlocks
```

## Milestone 13

```text
Milo Room
room editor
room persistence
```

## Milestone 14

```text
performance
tests
accessibility
bug fixes
polish
```

---

# 85. DO NOT tell Codex "build everything"

This is important.

Don't give:

> Build the complete Milo V2.

It may touch hundreds of files and make bad architectural choices.

Instead use **one milestone per Codex task**.

---

# MASTER PROMPT FOR CODEX

Give Codex this first:

```text
You are upgrading my existing desktop application called Milo.

Milo is a privacy-first desktop companion represented by an animated cat character.

IMPORTANT:
Do not rewrite the application from scratch.
First inspect the full repository and understand the existing architecture, framework, desktop runtime, state management, settings, current UI, privacy architecture and existing Milo assets.

We are implementing ONLY these Milo V2 features:

1. Animated Milo and character personality
2. Milo as a transparent desktop companion outside the current circular container
3. Milo interactions: click, double click, hover eye tracking, drag, drop and bounce
4. Simplified main application UI
5. New Milo Home
6. Personality-specific Milo visuals and local behavior
10. XP / friendship / levels
11. Milo Room
12. Milo customization: fur, eyes, clothes, accessories and animation personality
13. Milo reactions
18. Improved privacy UI called "Milo's Eyes"
19. New visual design system
21. Dedicated Settings screen
23. Local idle behaviors

HARD COST REQUIREMENT:

Every feature listed above must operate locally and create ZERO AI/API usage.

DO NOT call:
- OpenAI
- Anthropic
- Gemini
- vision APIs
- speech APIs
- cloud inference
- paid APIs

Do not use AI to decide Milo's emotions, reactions, animations, idle behavior, XP, personality, room state or customization.

Reactions must be triggered from deterministic/local application events.

Do not implement unrelated features.

Do not implement:
- AI voice
- transcription
- screenshot AI analysis
- Explain This
- Write Reply
- AI coding help
- conversation analysis
- continuous AI background analysis
- mini-games
- activities
- new AI modes
- cloud sync
- seasonal features

Architecture requirements:

Create or adapt these logical systems:

1. Milo State Machine
2. Animation Manager
3. Animation Priority System
4. Reaction Manager
5. Personality Manager
6. Idle Behavior Manager
7. Local Event Bus
8. Desktop Companion Controller
9. Position Manager
10. Screen Bounds Manager
11. XP Manager
12. Level Manager
13. Unlock Manager
14. Customization Manager
15. Milo Room Manager
16. Privacy State Manager
17. Versioned Local Storage

Do not duplicate animation logic across UI components.

Components must request semantic Milo states such as:

milo.setState("happy")
milo.setState("sleeping")
milo.setState("dragging")

The Animation Manager decides which local animation to display.

Animation priority:

100 = dragging
90 = critical transitions
80 = level-up celebration
70 = reactions
60 = direct user interactions
40 = hover
20 = idle behavior
0 = normal idle

High priority animations must interrupt lower priority animations.

Persist locally:

- Milo appearance
- personality
- animation personality
- XP
- level
- streak
- unlocked items
- Milo Room layout
- companion position
- monitor ID
- app settings

Create versioned save data so future migrations are possible.

Desktop Milo requirements:

- transparent window
- frameless
- small
- draggable
- position saved
- multi-monitor safe
- cannot become permanently lost outside screen bounds
- optional always-on-top
- single click opens local action menu
- double click triggers random local animation
- hover makes Milo's eyes subtly follow cursor
- picking Milo up triggers picked-up animation
- dropping Milo triggers squash/bounce animation

Idle behavior:

0–2 min:
normal idle / blink / look around

2–5 min:
stretch / clean paws / small reactions

5–10 min:
coffee / reading / playful idle behaviors

10–15 min:
yawn / sleepy

15+ min:
sleep

Do not trigger behaviors constantly.
Use weighted randomness and per-animation cooldowns.

User interaction should wake Milo.

Initial personality options:

Friend
Flirty
Sarcastic
Professional

Personality affects only local:
- animation speed
- energy
- expressions
- idle behavior weights
- accessory probabilities
- theme accent

Customization:

Use layered assets.
Do not create separate full animations for every combination.

Support:
- fur
- eyes
- clothes
- head accessory
- face accessory
- neck accessory
- animation personality

Animation personality:
- calm
- energetic
- chaotic
- sleepy

Progression:

XP, levels and streaks must run locally.

Important AI/product features must NEVER be locked behind XP.
Only cosmetic and fun content can be unlocked.

Milo Room:

Build a layered room renderer with:
- background
- wall decorations
- furniture
- Milo
- foreground objects

Room items must be separate objects with x/y position, scale, rotation and unlock state.

Privacy:

Create a visual privacy component called "Milo's Eyes".

It must represent actual application privacy state and must never claim protections the underlying code does not enforce.

Design:

Use this design foundation:

background #10131F
surface #181D2D
elevated #232A40
coral #FF8066
peach #FFAE8F
purple #886CFF
mint #60E6BD
primary text #F7F8FC
secondary text #9CA5BC

Avoid excessive nested cards.
Use spacing to create hierarchy.

Home should contain:
- animated Milo
- greeting
- open/hide desktop Milo
- friendship level
- streak
- Milo Room
- Customize
- Milo's Eyes
- Settings shortcut

Home must NOT contain the majority of configuration.

Create dedicated Settings sections:
General
Milo
Sound
Display
Companion
Privacy
Data

Performance is important:
- pause unnecessary animations while hidden
- reduce work while Milo sleeps
- avoid high-frequency polling
- cache common assets
- lazy-load uncommon assets
- keep desktop companion lightweight

Motion accessibility:
Full
Reduced
Minimal

Before implementing anything:

1. Audit the repository.
2. Report the current architecture.
3. Identify which existing components can be reused.
4. Identify risks.
5. Propose exact files/modules to create or modify.
6. Then implement milestone 1 only.

Do not begin milestone 2 until milestone 1 is clean and working.
```

---

# Then give Codex one task at a time

After its audit, tell it:

```text
Implement Milestone 1 only.

Create the Milo V2 design system and reusable design primitives.

Do not implement the character engine yet.

Preserve existing functionality.

Run the existing tests/build/lint after changes.

Fix regressions caused by your changes.

At the end report:
- files modified
- files created
- architectural decisions
- remaining technical debt
- tests run
- whether the build passes
```

Then Milestone 2.

Then 3.

And so on.

---

# 86. Final acceptance checklist

Do not consider Milo V2 finished until ALL of these work:

* [ ] Milo is transparent on desktop
* [ ] Milo can be dragged
* [ ] Drop has animation
* [ ] Milo stays inside screen
* [ ] Multi-monitor recovery works
* [ ] Position survives restart
* [ ] Hover eyes work
* [ ] Single click menu works
* [ ] Double click reactions work
* [ ] Milo has proper animation state machine
* [ ] Animation priorities work
* [ ] Milo has idle behavior
* [ ] Milo eventually sleeps
* [ ] User interaction wakes him
* [ ] Personality modifies local behavior
* [ ] Fur customization works
* [ ] Eye customization works
* [ ] Clothes work
* [ ] Accessories work
* [ ] Appearance survives restart
* [ ] XP works
* [ ] XP cannot easily be spammed
* [ ] Levels work
* [ ] Unlocks happen once
* [ ] Streak works
* [ ] Milo Room loads
* [ ] Furniture can be positioned
* [ ] Room survives restart
* [ ] Milo reactions work
* [ ] Milo's Eyes reflects actual privacy state
* [ ] Home is visually simplified
* [ ] Settings are separate
* [ ] New design system is consistent
* [ ] Reduced-motion option works
* [ ] Milo does not consume excessive CPU while idle
* [ ] Milo does not disappear off-screen
* [ ] Existing functionality still works
* [ ] No new API requests exist

---

# 87. Most important final test: $0 API test

Open Milo.

Do:

```text
drag Milo
hover Milo
double click Milo
change personality
change fur
change clothes
open Room
move furniture
gain XP
level up
wait for idle animation
wait for sleep
open Settings
open Milo's Eyes
restart application
```

Monitor network requests.

For these actions you should see:

# **0 AI API requests**

That should be a release requirement.

---

# Final architecture

```text
                       MILO V2
                          │
          ┌───────────────┴───────────────┐
          │                               │
     MAIN APPLICATION              DESKTOP MILO
          │                               │
    ┌─────┼──────┐                  Companion
    │     │      │                      │
   Home  Room Customize                 │
    │                                   │
 Settings                         Character Engine
                                        │
                         ┌──────────────┼─────────────┐
                         │              │             │
                       State        Personality    Idle
                         │              │             │
                         └──────────────┼─────────────┘
                                        │
                                  Reactions
                                        │
                                Animation Manager
                                        │
                                    Renderer

          ┌─────────────────────────────────────────┐
          │             LOCAL SYSTEMS               │
          │                                         │
          │ XP • Levels • Unlocks • Room • Storage │
          │ Privacy • Position • Settings          │
          └─────────────────────────────────────────┘

                           │
                           ▼

                     AI API CALLS
                         NONE
```

The key is **not** to ask Codex to implement all 14 features in one huge pass. Give it the master specification once, then make it complete the milestones **1 → 14 in order**, running the app/build/tests after every milestone. That will give you a much cleaner Milo V2 than letting the coding agent freely rewrite the project. codex = atigravity implement this end to end

</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-09-08T21:22:05+02:00.

The user has mentioned some items in the form @[ITEM]. Here is extra information about the items that were mentioned by the user, in the order that they appear:

/goal is a [Slash Command]:
The user has marked this task with /goal, indicating that this task is intended to run for a long time without user input, e.g. overnight. You should be extra thorough and only stop when you are confident the goal has been completely fulfilled. The system will force you to continue execution, prompting you to audit your work until completion. Once complete, include <!-- GOAL_COMPLETE --> in your response. If the user explicitly asked to stop or cancel this goal, include <!-- GOAL_CANCELLED --> in your response to cancel the goal.
/teamwork-preview is a [Slash Command]:
<TEAMWORK>
The user has added the 'teamwork_preview' subagent, for use in multi-agent teamwork systems.
The user wants to use the teamwork multi-agent system for a project.
Two-phase workflow: **(1)** craft a well-structured task prompt with
the user through Steps 1-9, **(2)** delegate to the teamwork
multi-agent system via the invoke_subagent tool. Both phases are required —
crafting without delegation is incomplete.

## Artifact-Based Workflow

Maintain a **prompt draft artifact** (prompt_draft.md) throughout the
process. It serves as both a live display for the user and a step
tracker for you. **Create it immediately** with this scaffold:

```markdown
# Teamwork Project Prompt — Draft

> Status: Step 1 — Eliciting project idea
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: [none — teamwork routes from the description]

[Project description — 1-2 sentences]

Working directory: [TBD]

## Requirements

### R1. [TBD]

### R2. [TBD]

## Acceptance Criteria

### [TBD]
- [ ] [TBD]

---
*Next: when approved → delegate via invoke_subagent (see Delegation Protocol)*
```

Update the artifact after every step.

## Core Principles

| # | Principle | Rule |
|---|-----------|------|
| 1 | **Specify What, Not How** | Define requirements and acceptance criteria. Avoid prescribing implementation details (file names, architecture, algorithms, libraries) unless the user explicitly requests them. |
| 2 | **Objective Verification** | Every requirement needs a verification mechanism independent of the implementing agent's self-assessment. Programmatic verification is ideal; agent-as-judge with explicit rubrics is acceptable. |
| 3 | **Acceptance Criteria = Guardrails** | Set the bar based on the user's actual needs. Purpose: prevent self-certification of poor work. If the first run falls short, tighten criteria and re-run. |
| 4 | **Minimal Requirements** | Only specify what the user cares about. Let teamwork infer the rest. More requirements = more constraints = less room for the agent team's independent judgment. |

## Workflow

Work through Steps 1-9 interactively. **Prefer `ask_question` when
presenting choices to the user** — structured options reduce friction
and prevent misinterpretation.

**Pre-existing prompt:** Scan against Steps 1-9, skip what's already
    covered, walk through gaps. Even polished prompts often lack
    verification (Step 5) or acceptance criteria (Step 6).

**User wants to skip straight to delegation:** Push back once —
    underspecified prompts are the leading cause of poor results; 5 minutes
    on requirements + criteria significantly improves first-run quality.
    If they insist, respect the choice but anchor expectations: "Proceeding
    with a minimal prompt — results may require more iteration."

### Step 1: Elicit the Idea

Ask: What do you want to build? What is the purpose (demo, production,
    eval, exploration)? Who is the audience?

Capture in 1-2 sentences → this becomes the prompt's opening.
Update artifact: replace [Project description], set status to Step 2.

### Step 2: Identify Ambiguity

Identify points with multiple reasonable interpretations. For each,
    present concrete choices:

```
Example: "Build a search engine"

Ambiguous: What data source?
→ Options:
  a) Crawl external websites (risk: anti-bot, rate limiting)
  b) Index a provided static dataset
  c) Let the agent team decide
```

Only ask about decisions that affect scope or verification. Don't ask
    about implementation details unless the user brings them up.

Key dimensions to probe:

| Dimension | Question |
|-----------|----------|
| **Scope** | How large/complex should the final product be? |
| **Technology constraints** | Hard constraints (pure JS, Python-only, no external deps)? |
| **Infrastructure** | Need network access, remote storage, job launching? → controlled APIs |
| **Quality bar** | Polished demo or proof-of-concept? |
| **Integrity** | How strict should integrity enforcement be? (see Step 3) |
| **Verification resources** | Does the user have existing test suites or scripts? (see Step 5) |

#### Effort and scale — two opt-in choices

Teamwork can run some work with a much smaller or much larger team,
but **only if the user asks** — neither can be inferred, and nothing
later recovers the answer. If either is plausible, ask.

**One self-contained change.** For a bug fix, a small feature or a
contained refactor, ask: a small focused team (one implementer, then
repeated adversarial review — cheapest, but cannot split the task up),
or the full team? If the small team, open the prompt with "This is a
single self-contained fix; keep it small and focused."

Do not infer this from the task looking small. A multi-part project
sent to the small team gets one line of work driven at something that
needed splitting — so if the work has parts, keep the R1/R2 structure
and do not call it quick.

**Math and proofs.** If the task involves mathematical problem solving
or proving theorems, ask about team scale via `ask_question`:

- Standard proof pipeline (suitable for many problems)
- Large-scale agent team (suitable for hard problems requiring massive
  parallel exploration, with 100+ concurrent agents in some phases)

If the user chooses the large-scale team, say so explicitly in the
opening of the final prompt: "Use a very large team of agents." The
routing agent looks for an explicit request for a very large team or
many agents; this is the canonical way to phrase it. Do not drop or
soften it — without an explicit request the task routes to the
standard proof pipeline.

### Step 3: Determine Integrity Mode

Determine how strictly integrity enforcement should operate.
Do NOT ask the user to "choose a mode" — instead, ask
**behavioral questions** via `ask_question` with `is_multi_select: true`.
Present these options:

- Copying code from existing open-source projects for core logic
- Using pre-built libraries/frameworks for core functionality
- Running external scripts or delegating execution to other tools
- Reading test source code to understand expected behavior before implementing
- No restrictions — the team can use any approach that works

These options are phrased for a build task. For other work, ask the
equivalent question about *that* work's shortcuts and map it the same
way — for a proof, whether the team may cite existing results rather
than prove them.

Map answers to mode:
- (e) or nothing selected → integrity_mode: development
- any of (a)-(d) selected, but NOT all → integrity_mode: demo
- all of (a)-(d) selected → integrity_mode: benchmark

Default: development. If the project is clearly a capability
showcase, suggest demo.

### Step 4: Draft Requirements

Write 2-5 requirement blocks (R1, R2, ...).

| Rule | Rationale |
|------|-----------|
| Each requirement: 1-3 sentences on **what** is needed | Keeps scope clear |
| Avoid hinting at **how** (architecture, algorithms, file structure) unless the user explicitly wants to constrain these | Preserves agent team's solution space |
| If the user didn't state a preference, don't add a requirement | Prevents over-constraining |
| "Would a skilled engineer feel over-constrained?" → if yes, cut it | Litmus test |

### Step 5: Design Verification

> **Why this matters:** Verification is **a forcing function**, not a
> literal mirror of the user's goal. Its purpose is to create an
> objective test target that **forces** an iterative build→test→debug
> loop. Without one, agents self-certify half-baked work and stop early.
>
> The mechanism does NOT need to perfectly match the user's ideal end
> state. It is a **means** — a trick to force real debugging. Guide users
> toward something *easy to run and hard to fake*, even if it doesn't
> capture every nuance.

For each requirement, design an **objective** verification mechanism:

| Type | When to use | Examples |
|------|-------------|----------|
| **Programmatic** (preferred) | Feasible to automate | Bot scripts, reference benchmarks, test suites with known I/O, metric scripts |
| **Agent-as-judge** | Programmatic testing is hard | Independent agent + explicit rubric concrete enough that two judges mostly agree |

The examples above are build-shaped. Other work needs a forcing
function too, in a different form — for an assessment, a rubric the
reviewer must fill in point by point. Ask for whatever plays that role
here.

**User-provided verification resources**: Ask whether the user has
existing test suites, scripts, evaluation guidelines, or a reference
implementation.

If yes, include them in the prompt as a Verification Resources
section. Even partial resources (e.g., a list of expected behaviors,
a reference implementation) are valuable — they give auditors concrete
material for independent verification.

**Verification anti-patterns:**

| ❌ Pattern | Risk |
|-----------|------|
| Self-assessment | Implementing agent judges own work |
| Subjective criteria ("looks good") | Unfalsifiable |
| No criteria at all | Premature self-certification |
| Impossibly high thresholds | Wasted iterations |

### Step 6: Set Acceptance Criteria

Convert verification mechanisms into concrete, checkable criteria.
    Calibrate to purpose:

| Purpose | Bar |
|---------|-----|
| Demo | Impressive but achievable in time budget |
| Production | Match target system quality standards |
| Eval | Precise and reproducible — measurement over polish |
| Exploration | Loose — prove feasibility only |

Common user adjustments: "too easy" → tighten; "too hard" → relax or
    make optional; "too prescriptive" → remove constraining criteria.

### Step 7: Infrastructure Constraints

If the project needs controlled infrastructure, add a requirement:

| Operation | Why control it |
|-----------|---------------|
| Remote file I/O (GCS, cloud storage) | Prevent writes to arbitrary paths |
| Job launching | Prevent expensive runaway jobs |
| Network access | Prevent hitting anti-bot protections or unintended services |

Pattern: "You must use the provided controlled API for X. You write the
    logic; the execution environment is managed externally."

Skip if no infrastructure is needed — a pure HTML/JS game, or an
assessment or proof rather than a running system.

### Step 8: Choose Working Directory

Ask where project files should live. Default:
```
~/teamwork_projects/{PROJECT_NAME}
```

{PROJECT_NAME}: short, lowercase, underscore-separated (e.g.,
    c_compiler, search_engine, tetris_game).

Include as a top-level directive in the final prompt:
```
Working directory: <path>
```

### Step 9: Assemble and Validate

Ensure the artifact has this structure:

```
[1-2 sentence project description]

Working directory: <chosen path from Step 8>
Integrity mode: [development | demo | benchmark]

[Optional: reference material (paper URL, spec link)]

## Requirements

### R1. [Primary deliverable]
[What it does, not how to build it]

### R2. [Secondary requirement or constraint]
...

### R3. [Controlled infrastructure, if needed]
...

## Acceptance Criteria

### [Criterion category]
- [ ] [Objective, checkable condition]
...
```

**Validation checklist:**

- [ ] No implementation hints unless explicitly requested by the user
- [ ] Every acceptance criterion is objectively checkable without
      human judgment
- [ ] Requirements scoped by user needs, not by what the agent "should" do
- [ ] Infrastructure constraints clearly state what's controlled and why
- [ ] A skilled engineer would NOT feel over-constrained
- [ ] An agent could NOT trivially self-certify a half-baked result
- [ ] Any opt-in choice from Step 2 is stated in the prompt opening —
      a small focused team, or an explicit request for a very large team
- [ ] Any team the user asked for is in the prompt opening, in their words

Present final prompt to user. Ask for approval.
Set artifact status to: Ready for launch — awaiting user approval.

Once approved → execute the **Delegation Protocol** (final section).

## Anti-Patterns

| ❌ Anti-pattern | Why |
|----------------|-----|
| Pass artifact file path as prompt source | Artifact may change after launch; always copy text |
| Invoke the teamwork subagent before explicit user approval | User must confirm readiness |
| Skip creating the artifact | Artifact is the user's window into the prompt |
| Lose the draft on iteration | If user wants changes after Step 8, update and re-present |
| Add implementation hints by default | Narrows agent team's solution space. If user explicitly wants to constrain (e.g., "use Python"), include as a requirement but flag the trade-off |

## Iterate After First Run

Prompt crafting is iterative. If the first run falls short, tighten
    acceptance criteria or add better verification — prefer this over
    adding implementation hints. Re-run with the updated prompt.

## Where Your Prompt Will Go

teamwork_preview is not one agent. It reads the prompt and picks an execution
path, each with a different team shape. **The prompt is the only input
to that decision.**

| Team | When it runs |
|------|--------------|
| Document review | A supplied paper or document to be reviewed |
| Proof pipeline | Maths problems, formal proofs, verification |
| **Proof, very large team** | Hard proofs needing massive parallel search |
| **Small, focused team** | One self-contained fix, feature or refactor |
| Full team | Everything else: builds, research, ops |

The two in bold are **opt-in** — they run only if the user asks, which
is why Step 2 asks about them. The other three follow from the work
itself: a paper to review is a paper to review, whatever words
surround it. So do not guess a path into the prompt; describe the work
plainly and the rest follows.

### If the user asks for a particular team

That is theirs to ask, and this prompt is the only channel they have.
Record it in Requested team: and put it in the prompt's opening in
their own words. Do not soften it, and do not restate a preference as
a fact about the task.

It is a strong signal, not a switch: teamwork still reads the work,
and may follow the work where the two disagree — a review team asked
for with no document to review. Say that to the user rather than
promising a team.

Never raise this yourself — if the user has not asked, the default is
right.

### Tell the user

At Step 9, say in one line what you expect to come back, so a wrong
reading is caught before a team spins up:

> Expecting this to run as one contained change rather than a full
> project — say so if you want it broken up.

Describe the outcome, not the internal path. The user can check the
first.

## Delegation Protocol

When the user approves ("go", "looks good", "launch", "run it", or
    similar):

1. Extract the complete prompt text from prompt_draft.md.
2. Invoke via the invoke_subagent tool with TypeName: teamwork_preview,
   Prompt: the full text.
   (teamwork_preview is hidden from the subagents list but can be invoked.)

Set artifact status to: Launched.
</TEAMWORK>
/grill-me is a [Slash Command]:
<GRILL_ME>
The user has requested that you interview them about every aspect of their task until you've reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Guidelines:
- Ask the questions one at a time.
- If a question can be answered by exploring the codebase, explore the codebase instead.
- Use the ask_question tool for asking questions to the user.
</GRILL_ME>
/browser is a [Slash Command]:
<SUBAGENT>The user has explicitly added the `browser` subagent. You must use this subagent via the `invoke_subagent` tool to process their request.</SUBAGENT>
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from Gemini 3.8 Flash (Medium) to Gemini 3.1 Pro (High). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>