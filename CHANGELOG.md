# Unreleased

- [Breaking][Changed] Requires Daggerheart 2.12.8 or newer.
- [Changed] "All Features" compendium rebuilt from the Daggerheart 2.12.8 adversaries. Steel-Skinned and Stolen Armor reduce damage severity again: their effects targeted the old per-damage-type severity rule, which the system replaced with a single value. Also picks up the system's text and effect corrections (Armor-Shredding Shards, Creeping Fire, Encumber, Last Grasp).
- [Fixed] Create Statblock on a class listed item UUIDs instead of names in Starting Items, Common Items Choice and Class Items Choice.
- [Fixed] Create Statblock on a class left out the SUBCLASSES section.

# 0.3.6

- [Added] GM prompts become secret blocks ([#5](https://github.com/brunocalado/dh-statblock-importer/issues/5)). Text wrapped in `*asterisks*` in a feature description is stored as a secret block, the GM-only section Foundry reveals on demand, in adversary, environment and standalone feature imports. In environments, the questions that end a feature are detected on their own when no marker is used, since the italics that set them apart are lost when pasting from a PDF. Checked against all 197 environment features of the Daggerheart system: 195 get exactly the official secret text; the other two differ only where the official secret is a rules note rather than a question, or where the actor name is replaced by a lookup.
- [Added] "GM Prompts as Secrets" setting in Configure → General: "Marker + environment questions" (default), "*Marker* only", or "Off". Off imports descriptions exactly as before.
- [Changed] Create Statblock writes secret blocks back as `*...*`, so an exported statblock re-imports with its secrets.
- [Changed] Rules text and actions are read without the secret part, so a question such as "how much damage…" no longer creates an action.
- [Fixed] Features with two or more bullet points lost the first bullet and produced nested paragraphs. A line continuing a description reopened the first paragraph instead of the last one.
- [Changed] Instructions journal: Environment, Adversaries and Feature pages document secret prompts, and the formatting prompt in "How to Use Unformatted Stats" asks for GM prompts in `*asterisks*`.

# 0.3.5

- [Changed] Feature icons are now chosen by feature type ([#6](https://github.com/brunocalado/dh-statblock-importer/issues/6)). The Icons tab has one icon each for Passive, Action and Reaction, used by adversary, environment and standalone feature imports alike, so a sheet shows at a glance which features are passive or reactions. The separate Adversary, Environment and Feature Item icons are gone; previously customised icons reset to the new defaults.
- [Changed] "Use actor portrait as feature icon" is now a single "Adversary/Environment Feature Icon" choice, "Icon by feature type" or "Actor portrait", instead of one checkbox per actor type.
- [Added] "Apply to compendium features" option, on by default. Features matched from a compendium also get the type icon (or the portrait) instead of their original artwork. The compendium itself is not changed.
- [Changed] The Horde feature built for horde adversaries uses the Passive icon instead of its own fixed icon.

# 0.3.4

- [Added] Countdown actions ([#7](https://github.com/brunocalado/dh-statblock-importer/issues/7)). `Countdown (6)`, `Countdown (1d8)`, `Countdown (Loop 1d6)`, `Countdown (Increasing 4)` and `Countdown (Decreasing 8)` in a description create a "Start Countdown" action. It adds an encounter countdown named after the feature to the tracker and rolls the start value when it is a dice formula. It is ticked down manually, because the text does not reliably say what makes a countdown tick. `Countdown (see "...")` or a countdown with no value creates nothing.
- [Fixed] Dice that are not damage created damage actions. Any description containing the word "damage" turned every dice formula into a damage action, e.g. "mark 1d4 Stress", "1d6 targets" or "Countdown (Loop 2d6)". A damage action now needs the formula directly before `[direct] [physical|magic] damage`.
- [Fixed] Damage type and direct were applied to the whole description, so "3d8 direct physical damage, then 2d6 magic damage" produced two direct physical actions. Each damage action now reads its own type and direct flag.
- [Fixed] `mag damage` created a physical damage action. The abbreviations `phy` and `mag`, which the formatting prompt in the Instructions journal asks for, now work like `physical` and `magic`.
- [Added] Flat damage with an explicit type, such as `12 direct magic damage` or `5 physical damage`, creates a damage action. A number with no type, as in "for every 6 damage a PC deals", does not.
- [Changed] Dice inside `Countdown (...)` are no longer wrapped as `[[/r ]]` inline rolls; the countdown action rolls them itself.
- [Changed] Instructions journal: "Action Creation Rules" rewritten for the new damage rule, with a new Countdowns section and a full feature example.

# 0.3.3

- Requires Daggerheart 2.10.6 or newer
- "All Features" compendium rebuilt from the Daggerheart 2.10.6 adversaries
## Schema update for Daggerheart 2.10.6

- [Fixed] Horde adversaries imported without Horde HP or the half-HP damage swap. The system moved horde data from `hordeHp` and `damage.main.valueAlt` into `system.typeData` (`hordeHP`, `hordeDamage`), and the swap now comes from a flagged "Horde" feature whose effect replaces the standard attack damage. The system only creates that feature when an existing actor changes type, so the importer now builds it itself, replacing the `Horde (XdY)` text feature.
- [Fixed] Dice attack bonuses such as `ATK: +2d4` lost the dice part. Since system 2.10.4 the attack bonus is a formula.
- [Fixed] Positive attack bonuses showed as `++2` in the exporter and in the system's own sheet embed. The leading `+` is no longer stored.
- [Fixed] Create Statblock now reads Horde HP and Horde damage from `typeData`, and fills in data lookups in feature text (e.g. the Horde damage and damage type).
- [Changed] +Features no longer copies the Horde feature to the world, since it only works on its own horde actor.
- [Changed] "All Features" compendium: the old `Horde (1d4+1)`-style entries are replaced by the system's single "Horde" feature (one per tier). Unused alternate damage (`valueAlt`) is now empty, matching 2.10.
## Development

- [Added] `tools/build-features.mjs` rebuilds the "All Features" compendium from the system's adversary pack, with no Foundry running and no manual drag-and-drop. Rebuilding against an unchanged system gives an identical pack.
- [Added] License header in every script and stylesheet.

# 0.3.2

- Requires Daggerheart 2.9.1 or newer
- Homebrew feature template (the module skeleton linked from the Instructions journal) now declares v14 compatibility
## Schema update for Daggerheart 2.9.1

- [Fixed] Create Statblock produced an attack line with no damage. The system moved the attack's HP damage from `damage.parts` into `damage.main`, and `DHBaseAction.migrateData` strips `parts` when an actor loads, so the exporter was reading a field that no longer exists on a live actor.
- [Fixed] The `Horde (XdY)` suffix was never restored on export. It read `damage.parts[0]`, which matched nothing even under the old schema, since `parts` was keyed by `"hitPoints"` rather than indexed.
- [Fixed] Exported damage dropped a dice count of 1 (`d10+2` instead of `1d10+2`), which is not the format statblocks use or the importer expects back.
- [Changed] `damage.parts` replaced by `damage.main` + `damage.resources` throughout the importer — weapon attack, adversary attack, Horde alternate damage, and every inline action damage. `includeBase` and `direct` moved inside `main`. The importer no longer depends on the system's backward-compatibility shim.

# 0.3.1

- The Forge filepicker support
- Compendiums updated to Daggerheart 2.3.2
## Schema update for Daggerheart 2.3.2

- [Fixed] `damage.parts` migrated from array to object (keyed by `"hitPoints"`) — affects weapon attack, adversary attack, and all inline action damage across the importer.
- [Fixed] Armor schema updated: `baseScore` + `marks` replaced by `armor: { current, max }`.
- [Fixed] Adversary resources: `isReversed` field removed, `max` default changed to `null`.
- [Changed] `prototypeToken` for adversary and environment updated with v14 fields: `depth`, `turnMarker`, `movementAction`; `detectionModes` changed to object.
- [Changed] Consumable: `destroyOnEmpty` field removed (no longer in system schema).
- [Changed] All action objects now include `areas: []` field.
- [Changed] Weapon and armor templates now include `quantity: 1`.
- [Changed] Adversary template now includes `advantageSources` and `disadvantageSources` fields.

# 0.3.0

- v14 only
- Compendiums updated to v14

# 0.2.7

- [Fixed] "Use actor portrait as feature icon" now correctly applies the actor's portrait to both embedded and standalone (+Features) non-compendium features instead of using the generic feature icon.


# 0.2.6

- You can pick default icons
- [Changed] Debug Mode setting moved from the custom Importer Configuration window to Foundry's native Module Settings panel. Requires a full Foundry reload (F5) after module update for the change to take effect.


# 0.2.5
- [Fixed] Domain Card import failing with `DataModelValidationError` when domain casing didn't match system enum values. Domains are now resolved case-insensitively against native and homebrew choices.

# 0.2.4
- removed duplicated chat message. chatDisplay was being added, and the system set it to true.

# 0.2.3
- The pasted text will undergo additional cleaning.
- CSS refactor to make maintenance easier.
- [Added] Class item export support for class, ancestry and community

# 0.2.2
- Bug Fix for Consumable

# 0.1.9
- +docs

# 0.1.8
- Bug fix: imported weapons work well now
- Uses default templates to prevent errors and make it easier to update in the future
- performance update for mass import
- generate code for weapon/armor features
- module template for you homebrew features

# 0.1.6
- enviroment only accept correct types
- can detect physical/magical damage type to create the damage action
- can detect direct damage
- It can detect spend hope to create actions

# 0.1.5
- import enviroment/adversary can also import the features the world
- Improved built in docs

# 0.1.4
- enviroments improvement and fix: Works for "Wondrous Environments"