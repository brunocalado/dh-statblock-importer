# 0.3.1

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