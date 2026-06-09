import { MODULE_ID } from "./constants.js";
import { StatblockConfig } from "./config.js";
import { TEMPLATES } from "./templates.js";
import { FeatureCodeDialog } from "./code-dialog.js";
import { TextNormalizer } from "./utils/text-normalizer.js";
import {
  actorTypeLabel,
  adversaryTypeLabel,
  environmentTypeLabel,
  featureFormLabel,
  format,
  itemTypeLabel,
  localize,
  localizeKey,
  localizeSettingValue,
  moduleKey,
  rangeLabel,
  titleCase
} from "./i18n.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main Importer Application.
 */
export class StatblockImporter extends HandlebarsApplicationMixin(ApplicationV2) {

  constructor(options = {}) {
    super(options);
    this.options.window.title = localize("Importer.Title");
  }

  /** Valid adversary types (lowercase) */
  static VALID_ADVERSARY_TYPES = ["bruiser", "horde", "leader", "minion", "ranged", "skulk", "social", "solo", "standard", "support"];

  /** Valid environment types (lowercase) */
  static VALID_ENVIRONMENT_TYPES = ["exploration", "social", "traversal", "event"];

  /** Import modes that create Item documents instead of Actor documents. */
  static ITEM_IMPORT_MODES = ["loot", "consumable", "weapon", "armor", "feature", "domainCard"];

  /** Folder Colors based on Adversary Type */
  static TYPE_COLORS = {
      "Bruiser": "#4a0404",      // Deep Blood Red
      "Horde": "#0f3d0f",        // Dark Forest Green
      "Leader": "#5c4905",       // Dark Bronze/Brown
      "Minion": "#2f3f4f",       // Dark Slate
      "Ranged": "#002366",       // Navy Blue
      "Skulk": "#1a0033",        // Deep Indigo/Black
      "Social": "#660033",       // Deep Maroon/Pink
      "Solo": "#000000",         // Black
      "Standard": "#3b1e08",     // Dark Chocolate
      "Support": "#004d40",      // Deep Teal
      "Unknown": "#333333"       // Dark Gray
  };

  /** Folder Colors based on Environment Type */
  static ENVIRONMENT_TYPE_COLORS = {
      "Event": "#4a0404",        // Deep Blood Red
      "Traversal": "#0f3d0f",    // Dark Forest Green
      "Exploration": "#5c4905",  // Dark Bronze/Brown
      "Social": "#002366",       // Navy Blue
      "Unknown": "#333333"       // Dark Gray
  };

  static isItemMode(mode) {
      return StatblockImporter.ITEM_IMPORT_MODES.includes(mode);
  }

  static _folderSetting(settingKey, fallbackPath) {
      return localizeSettingValue(game.settings.get(MODULE_ID, settingKey), fallbackPath);
  }

  static _rawFolderSetting(settingKey, fallbackPath) {
      const value = game.settings.get(MODULE_ID, settingKey);
      return (typeof value === "string" && value.trim()) ? value : moduleKey(fallbackPath);
  }

  static async _findOrCreateFolder({ name, type, color, folder, legacyNames = [] }) {
      const matchesParent = candidate => folder === undefined || candidate.folder?.id === folder;
      let found = game.folders.find(candidate => candidate.name === name && candidate.type === type && matchesParent(candidate));

      if (!found) {
          const legacyName = legacyNames.find(candidateName => candidateName && candidateName !== name);
          if (legacyName) {
              found = game.folders.find(candidate => candidate.name === legacyName && candidate.type === type && matchesParent(candidate));
              if (found) await found.update({ name });
          }
      }

      if (found) return found;

      const data = { name, type, color };
      if (folder) data.folder = folder;
      return Folder.create(data);
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    tag: "form",
    window: {
      title: moduleKey("Importer.Title"),
      icon: "fas fa-skull",
      resizable: true,
      contentClasses: ["standard-form"]
    },
    position: {
      width: 900,
      height: 600
    },
    actions: {
      parse: StatblockImporter._onParse,
      validate: StatblockImporter._onValidate,
      config: StatblockImporter._onConfig,
      instructions: StatblockImporter._onInstructions,
      plusFeatures: StatblockImporter._onPlusFeatures,
      plusFeaturesHelp: StatblockImporter._onPlusFeaturesHelp,
      codeGenerator: StatblockImporter._onCodeGenerator,
      codeGeneratorHelp: StatblockImporter._onCodeGeneratorHelp
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/importer.hbs`
    }
  };

  /* -------------------------------------------- */
  /* Initialization Helper                       */
  /* -------------------------------------------- */

  static registerSettings() {
      // Feature Packs
      if (!game.settings.settings.has(`${MODULE_ID}.selectedCompendiums`)) {
          game.settings.register(MODULE_ID, "selectedCompendiums", {
              name: moduleKey("Settings.selectedCompendiums"),
              scope: "client",
              config: false,
              type: Array,
              default: [`${MODULE_ID}.all-features`]
          });
      }

      // Actor Packs
      if (!game.settings.settings.has(`${MODULE_ID}.selectedActorCompendiums`)) {
          game.settings.register(MODULE_ID, "selectedActorCompendiums", {
              name: moduleKey("Settings.selectedActorCompendiums"),
              scope: "client",
              config: false,
              type: Array,
              default: ["daggerheart.adversaries"]
          });
      }

      // Initialization Flag
      if (!game.settings.settings.has(`${MODULE_ID}.configInitialized`)) {
          game.settings.register(MODULE_ID, "configInitialized", {
              name: moduleKey("Settings.configInitialized"),
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // Folder Names (Actors)
      if (!game.settings.settings.has(`${MODULE_ID}.adversaryFolderName`)) {
          game.settings.register(MODULE_ID, "adversaryFolderName", {
              name: moduleKey("Settings.adversaryFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedAdversaries")
          });
      }

      if (!game.settings.settings.has(`${MODULE_ID}.environmentFolderName`)) {
          game.settings.register(MODULE_ID, "environmentFolderName", {
              name: moduleKey("Settings.environmentFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedEnvironments")
          });
      }

      // Folder Names (Items)
      if (!game.settings.settings.has(`${MODULE_ID}.lootFolderName`)) {
          game.settings.register(MODULE_ID, "lootFolderName", {
              name: moduleKey("Settings.lootFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedLoot")
          });
      }

      if (!game.settings.settings.has(`${MODULE_ID}.consumableFolderName`)) {
          game.settings.register(MODULE_ID, "consumableFolderName", {
              name: moduleKey("Settings.consumableFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedConsumables")
          });
      }

      if (!game.settings.settings.has(`${MODULE_ID}.weaponFolderName`)) {
          game.settings.register(MODULE_ID, "weaponFolderName", {
              name: moduleKey("Settings.weaponFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedWeapons")
          });
      }

      if (!game.settings.settings.has(`${MODULE_ID}.armorFolderName`)) {
          game.settings.register(MODULE_ID, "armorFolderName", {
              name: moduleKey("Settings.armorFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedArmors")
          });
      }

      if (!game.settings.settings.has(`${MODULE_ID}.featureFolderName`)) {
          game.settings.register(MODULE_ID, "featureFolderName", {
              name: moduleKey("Settings.featureFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedFeatures")
          });
      }

      if (!game.settings.settings.has(`${MODULE_ID}.domainCardFolderName`)) {
          game.settings.register(MODULE_ID, "domainCardFolderName", {
              name: moduleKey("Settings.domainCardFolderName"),
              scope: "world",
              config: false,
              type: String,
              default: moduleKey("Folders.importedDomainCards")
          });
      }

      // Separator Mode (blankLine or separator)
      if (!game.settings.settings.has(`${MODULE_ID}.separatorMode`)) {
          game.settings.register(MODULE_ID, "separatorMode", {
              name: moduleKey("Settings.separatorMode"),
              scope: "world",
              config: false,
              type: String,
              default: "blankLine"
          });
      }

      // Debug Mode — config: true so Foundry renders it natively in Module Settings
      if (!game.settings.settings.has(`${MODULE_ID}.debugMode`)) {
          game.settings.register(MODULE_ID, "debugMode", {
              name: moduleKey("Settings.debugMode.name"),
              hint: moduleKey("Settings.debugMode.hint"),
              scope: "client",
              config: true,
              type: Boolean,
              default: false
          });
      }

      // +Features Toggle State
      if (!game.settings.settings.has(`${MODULE_ID}.plusFeaturesEnabled`)) {
          game.settings.register(MODULE_ID, "plusFeaturesEnabled", {
              name: moduleKey("Settings.plusFeaturesEnabled"),
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // +Code Generator Toggle State
      if (!game.settings.settings.has(`${MODULE_ID}.codeGeneratorEnabled`)) {
          game.settings.register(MODULE_ID, "codeGeneratorEnabled", {
              name: moduleKey("Settings.codeGeneratorEnabled"),
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // Feature Icon: Adversary
      if (!game.settings.settings.has(`${MODULE_ID}.featureIconAdversary`)) {
          game.settings.register(MODULE_ID, "featureIconAdversary", {
              name: moduleKey("Settings.featureIconAdversary"),
              scope: "world",
              config: false,
              type: String,
              default: "icons/magic/symbols/star-solid-gold.webp"
          });
      }

      // Feature Icon: Environment
      if (!game.settings.settings.has(`${MODULE_ID}.featureIconEnvironment`)) {
          game.settings.register(MODULE_ID, "featureIconEnvironment", {
              name: moduleKey("Settings.featureIconEnvironment"),
              scope: "world",
              config: false,
              type: String,
              default: "icons/environment/wilderness/cave-entrance.webp"
          });
      }

      // Feature Icon: Feature (standalone Item mode)
      if (!game.settings.settings.has(`${MODULE_ID}.featureIconFeature`)) {
          game.settings.register(MODULE_ID, "featureIconFeature", {
              name: moduleKey("Settings.featureIconFeature"),
              scope: "world",
              config: false,
              type: String,
              default: "icons/magic/symbols/star-solid-gold.webp"
          });
      }

      // Use actor portrait for adversary features
      if (!game.settings.settings.has(`${MODULE_ID}.featureIconMatchAdversary`)) {
          game.settings.register(MODULE_ID, "featureIconMatchAdversary", {
              name: moduleKey("Settings.featureIconMatchAdversary"),
              scope: "world",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // Use actor portrait for environment features
      if (!game.settings.settings.has(`${MODULE_ID}.featureIconMatchEnvironment`)) {
          game.settings.register(MODULE_ID, "featureIconMatchEnvironment", {
              name: moduleKey("Settings.featureIconMatchEnvironment"),
              scope: "world",
              config: false,
              type: Boolean,
              default: false
          });
      }
  }

  /**
   * Log debug messages if debug mode is enabled
   */
  static debugLog(message, data = null) {
      const debugMode = game.settings.get(MODULE_ID, "debugMode");
      if (debugMode) {
          console.log(`DH Importer [DEBUG] | ${message}`);
          if (data !== null) {
              console.log(data);
          }
      }
  }

  /**
   * Log error messages (always logs, but with more detail in debug mode)
   */
  static errorLog(message, error = null, context = null) {
      const debugMode = game.settings.get(MODULE_ID, "debugMode");
      console.error(`DH Importer [ERROR] | ${message}`);
      if (error) {
          console.error(error);
      }
      if (debugMode && context) {
          console.log("DH Importer [DEBUG] | Error Context:");
          console.log(context);
      }
  }

  /* -------------------------------------------- */
  /* Context & Rendering                         */
  /* -------------------------------------------- */

  async _prepareContext(options) {
      const context = await super._prepareContext(options);
      context.plusFeaturesEnabled = game.settings.get(MODULE_ID, "plusFeaturesEnabled");
      context.codeGeneratorEnabled = game.settings.get(MODULE_ID, "codeGeneratorEnabled");
      return context;
  }

  _onRender(context, options) {
      super._onRender(context, options);

      // Add listener to mode select to show/hide +Features and +Code buttons
      const modeSelect = this.element.querySelector("select[name='importMode']");
      const plusFeaturesContainer = this.element.querySelector(".dh-plus-features-container");
      const codeGeneratorContainer = this.element.querySelector(".dh-code-generator-container");

      if (modeSelect) {
          const updateButtonsVisibility = () => {
              const mode = modeSelect.value;

              // +Features visible for adversary/environment
              if (plusFeaturesContainer) {
                  const showPlusFeatures = (mode === "adversary" || mode === "environment");
                  plusFeaturesContainer.style.display = showPlusFeatures ? "flex" : "";
              }

              // +Code visible for weapon/armor
              if (codeGeneratorContainer) {
                  const showCodeGenerator = (mode === "weapon" || mode === "armor");
                  codeGeneratorContainer.style.display = showCodeGenerator ? "flex" : "";
              }
          };

          // Initial state
          updateButtonsVisibility();

          // Listen for changes
          modeSelect.addEventListener("change", updateButtonsVisibility);
      }
  }

  /* -------------------------------------------- */
  /* Action Handlers                             */
  /* -------------------------------------------- */

  static _onConfig(event, target) {
      new StatblockConfig().render(true);
  }

  /** Map of import modes to their corresponding journal page UUIDs */
  static INSTRUCTION_PAGES = {
      adversary: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.nlrsgNbZXTGn1nts",
      environment: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.fAxQ9BhNIrtqrrsp",
      loot: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.vlcNkeXV3hQTZclx",
      consumable: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.nuyINYV4GIjtC1lF",
      armor: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.lvHdUjqE5GMmApWZ",
      weapon: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.6v8fr6yfNI4a9OUL",
      feature: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.BcLq3PdLENjijqLI",
      domainCard: "Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.VXRK8rb5UBdOOLa2"
  };

  static async _onInstructions(event, target) {
      try {
          // Get current mode from the form
          const formElement = this.element;
          const modeSelect = formElement.querySelector("select[name='importMode']");
          const mode = modeSelect?.value || "adversary";

          // Get the page UUID for this mode
          const pageUuid = StatblockImporter.INSTRUCTION_PAGES[mode];

          if (pageUuid) {
              const page = await fromUuid(pageUuid);
              if (page) {
                  // Open the parent journal entry and navigate to the specific page
                  const journal = page.parent;
                  if (journal) {
                      journal.sheet.render(true, { pageId: page.id });
                  }
              } else {
                  ui.notifications.warn(format("Importer.instructionsMissing", { mode }));
                  console.warn(`DH Importer | Could not find JournalEntryPage with UUID: ${pageUuid}`);
              }
          } else {
              // Fallback to main journal if mode not found
              const doc = await fromUuid("Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp");
              if (doc) {
                  doc.sheet.render(true);
              }
          }
      } catch (err) {
          StatblockImporter.errorLog(localize("Importer.errorOpeningInstructions"), err);
          ui.notifications.error(localize("Importer.instructionsOpenFailed"));
      }
  }

  static async _onPlusFeatures(event, target) {
      const currentState = game.settings.get(MODULE_ID, "plusFeaturesEnabled");
      const newState = !currentState;
      await game.settings.set(MODULE_ID, "plusFeaturesEnabled", newState);

      // Update button visual state
      const btn = target.closest("button");
      if (btn) {
          btn.classList.toggle("active", newState);
      }
  }

  static async _onPlusFeaturesHelp(event, target) {
      try {
          const doc = await fromUuid("Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.wvgvxX1ksmUL2Ahj");
          if (doc) {
              // Open the parent journal entry and navigate to the page
              const journal = doc.parent;
              if (journal) {
                  journal.sheet.render(true, { pageId: doc.id });
              }
          } else {
              ui.notifications.warn(localize("Importer.plusFeaturesMissing"));
              console.warn("DH Importer | Could not find JournalEntryPage with UUID: Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.wvgvxX1ksmUL2Ahj");
          }
      } catch (err) {
          StatblockImporter.errorLog(localize("Importer.errorOpeningPlusFeatures"), err);
          ui.notifications.error(localize("Importer.plusFeaturesOpenFailed"));
      }
  }

  static async _onCodeGenerator(event, target) {
      const currentState = game.settings.get(MODULE_ID, "codeGeneratorEnabled");
      const newState = !currentState;
      await game.settings.set(MODULE_ID, "codeGeneratorEnabled", newState);

      // Update button visual state
      const btn = target.closest("button");
      if (btn) {
          btn.classList.toggle("active", newState);
      }
  }

  static async _onCodeGeneratorHelp(event, target) {
      try {
          const doc = await fromUuid("Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.LiVwLebJ7Ih66gBw");
          if (doc) {
              const journal = doc.parent;
              if (journal) {
                  journal.sheet.render(true, { pageId: doc.id });
              }
          } else {
              ui.notifications.warn(localize("Importer.codeHelpMissing"));
              console.warn("DH Importer | Could not find JournalEntryPage with UUID: Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.LiVwLebJ7Ih66gBw");
          }
      } catch (err) {
          StatblockImporter.errorLog(localize("Importer.errorOpeningCodeHelp"), err);
          ui.notifications.error(localize("Importer.codeHelpOpenFailed"));
      }
  }

  /**
   * Helper to determine the default image based on mode and subtype (actorType or item subType)
   */
  static _getDefaultImage(mode, subtype = null) {
      if (mode === "loot") return "icons/containers/chest/chest-reinforced-steel-green.webp";
      if (mode === "consumable") return "icons/consumables/potions/potion-flask-corled-pink-red.webp";
      if (mode === "weapon") return "icons/weapons/swords/sword-guard-flanged-purple.webp";
      if (mode === "armor") return "icons/equipment/chest/breastplate-banded-leather-purple.webp";
      if (mode === "feature") {
          return game.settings.get(MODULE_ID, "featureIconFeature")
              || "icons/magic/symbols/star-solid-gold.webp";
      }
      
      if (mode === "domainCard") {
          if (subtype === "grimoire") return "icons/sundries/books/book-embossed-spiral-purple-white.webp";
          if (subtype === "ability") return "icons/magic/control/silhouette-hold-change-blue.webp";
          if (subtype === "spell") return "icons/sundries/documents/document-symbol-triangle-pink.webp";
          return "icons/sundries/scrolls/scroll-runed-blue.webp";
      }

      if (subtype === "environment") return "icons/environment/wilderness/cave-entrance.webp";
      return "modules/dh-statblock-importer/assets/images/skull.webp";
  }

  /**
   * Builds a case-insensitive lookup map of valid domain identifiers from
   * native system choices and homebrew world settings.
   * @returns {Object<string, string>} Map of lowercased domain keys/labels to their canonical enum values
   */
  static _buildDomainMap() {
      const domainMap = {};

      // The domain field's choices getter already merges native + homebrew domains
      try {
          const domainField = CONFIG.Item?.dataModels?.domainCard?.schema?.fields?.domain;
          const choices = typeof domainField?.choices === "function"
              ? domainField.choices()
              : domainField?.choices ?? {};
          for (const key of Object.keys(choices)) {
              domainMap[key.toLowerCase()] = key;
          }
      } catch (e) {
          console.warn("dh-statblock-importer | Failed to read domain choices — domain validation may fail.", e);
      }

      return domainMap;
  }

  static async _onValidate(event, target) {
    const formElement = this.element;
    const textarea = formElement.querySelector("textarea[name='statblockText']");
    const modeSelect = formElement.querySelector("select[name='importMode']");
    const previewBox = formElement.querySelector("#dh-importer-preview");

    if (!textarea || !textarea.value.trim()) {
      previewBox.innerHTML = `<p style="color:red">${localize("Importer.emptyValidate")}</p>`;
      return;
    }

    const text = textarea.value.trim();
    const mode = modeSelect?.value || "adversary";
    
    // Determine parsing strategy
    let blocks = [];
    let isItemMode = StatblockImporter.isItemMode(mode);

    if (isItemMode) {
        blocks = StatblockImporter.splitSimpleItems(text);
    } else {
        blocks = StatblockImporter.splitStatblocks(text);
    }

    const isMultiple = blocks.length > 1;
    let fullHtml = "";

    if (isMultiple) {
      fullHtml += `<div class="dh-preview-item success" style="background:rgba(72,187,72,0.2);padding:8px;margin-bottom:10px;border-radius:4px;"><strong>${localize("Importer.batchMode")}:</strong> ${format("Importer.itemsDetected", { count: blocks.length })}</div>`;
    }

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      let result;

      try {
        if (mode === "weapon") {
            result = StatblockImporter.parseWeaponData(block);
        } else if (mode === "armor") {
            result = StatblockImporter.parseArmorData(block);
        } else if (mode === "feature") {
            result = StatblockImporter.parseFeatureData(block);
        } else if (mode === "domainCard") {
            result = StatblockImporter.parseDomainCardData(block);
        } else if (mode === "loot" || mode === "consumable") {
            result = StatblockImporter.parseSimpleItemData(block, mode);
        } else {
            result = await StatblockImporter.parseStatblockData(block, mode);
        }
      } catch (error) {
        const firstLine = block.split(/\r?\n/)[0] || localize("Common.unknown");
        fullHtml += `<div class="dh-preview-item warning"><strong>${format("Importer.blockError", { index: blockIndex + 1 })}:</strong> ${error.message} (${firstLine})</div>`;
        continue;
      }

      // --- HTML Generation for Preview ---
      const defaultImg = result.img || StatblockImporter._getDefaultImage(mode, result.actorType);
      fullHtml += `<div class="dh-preview-entry">`;
      
      const labelPrefix = isMultiple ? `#${blockIndex + 1}: ` : "";
      
      fullHtml += `
          <div class="dh-preview-header">
              <img src="${defaultImg}" class="dh-preview-img" data-idx="${blockIndex}" title="${localize("Importer.imageChange")}">
              <div class="dh-preview-name">${labelPrefix}${result.name}</div>
          </div>
      `;

      fullHtml += `<div class="dh-preview-body">`;

      const labels = {
        type: localizeKey("DAGGERHEART.GENERAL.type", localize("Fields.type")),
        tier: localizeKey("DAGGERHEART.ACTORS.Adversary.FIELDS.tier.label", localize("Fields.tier")),
        trait: localize("Fields.trait"),
        range: localizeKey("DAGGERHEART.ACTORS.Adversary.FIELDS.attack.range.label", localize("Fields.range")),
        damage: localizeKey("DAGGERHEART.ACTORS.Adversary.FIELDS.attack.damage.value.label", localize("Fields.damage")),
        damageType: localizeKey("DAGGERHEART.ACTORS.Adversary.FIELDS.attack.damage.type.label", localize("Fields.damageType")),
        burden: localize("Fields.burden"),
        fullDescription: localize("Importer.fullDescription"),
        description: localizeKey("DAGGERHEART.GENERAL.description", localize("Fields.description")),
        actionType: localize("Importer.actionType"),
        cardType: localize("Importer.cardType"),
        actorType: localize("Importer.actorType"),
        hordeHP: localize("Importer.hordeHP"),
        hp: localize("Fields.hp"),
        stress: localizeKey("DAGGERHEART.GENERAL.stress", localize("Fields.stress")),
        thresholds: localize("Fields.thresholds"),
        attack: localizeKey("DAGGERHEART.ACTIONS.TYPES.attack.name", localize("Fields.attack")),
        atkBonus: localize("Importer.atkBonus"),
        hordeDamage: localizeKey("DAGGERHEART.ACTORS.Adversary.hordeDamage", localize("Importer.hordeDamage")),
        experience: localizeKey("DAGGERHEART.APPLICATIONS.CharacterCreation.tabs.experience", localize("Fields.experience")),
        motives: localize("Importer.motives"),
        impulses: localizeKey("DAGGERHEART.ACTORS.Environment.FIELDS.impulses.label", localize("Fields.impulses")),
        potentialAdversaries: localize("Importer.potentialAdversaries"),
        features: localizeKey("DAGGERHEART.GENERAL.features", localize("Fields.features")),
        domain: localizeKey("DAGGERHEART.GENERAL.Domain.single", localize("Fields.domain")),
        level: localizeKey("DAGGERHEART.GENERAL.level", localize("Fields.level")),
        recallCost: localizeKey("DAGGERHEART.ITEMS.DomainCard.recallCost", localize("Fields.recallCost")),
        baseScore: localizeKey("DAGGERHEART.ITEMS.Armor.baseScore", localize("Fields.baseScore")),
        armorScore: localize("Fields.armorScore")
      };
      
      const show = (label, value) => {
        if (value !== undefined && value !== null && value !== "") {
          return `<div class="dh-preview-item success"><strong>${label}:</strong> ${value}</div>`;
        }
        return `<div class="dh-preview-item warning"><strong>${label}:</strong> ${localize("Common.notFound")}</div>`;
      };

      if (mode === "weapon") {
          // WEAPON PREVIEW
          fullHtml += show(labels.type, itemTypeLabel("weapon"));
          fullHtml += show(labels.tier, result.system.tier);
          fullHtml += show(labels.trait, result.system.attack.roll.trait);
          fullHtml += show(labels.range, rangeLabel(result.system.attack.range));

          const weaponParts = Object.values(result.system.attack.damage.parts ?? {});
          if (weaponParts.length > 0) {
              const part = weaponParts[0];
              const dmgStr = `${part.value.flatMultiplier > 1 ? part.value.flatMultiplier : ""}${part.value.dice}${part.value.bonus ? (part.value.bonus > 0 ? "+"+part.value.bonus : part.value.bonus) : ""} ${part.type.join("/")}`;
              fullHtml += show(labels.damage, dmgStr);
          }

          fullHtml += show(labels.burden, result.system.burden);

          // Show combined description (Feature + Desc)
          const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
          fullHtml += `<div class="dh-preview-item success"><strong>${labels.fullDescription}:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;

      } else if (mode === "armor") {
          // ARMOR PREVIEW
          fullHtml += show(labels.type, itemTypeLabel("armor"));
          fullHtml += show(labels.tier, result.system.tier);
          fullHtml += show(labels.armorScore, result.system.armor?.max);
          fullHtml += show(labels.thresholds, `${result.system.baseThresholds?.major || "?"}/${result.system.baseThresholds?.severe || "?"}`);

          if (result.system.description) {
              const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
              fullHtml += `<div class="dh-preview-item success"><strong>${labels.description}:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
          }

      } else if (mode === "feature") {
          // FEATURE PREVIEW
          fullHtml += show(labels.type, itemTypeLabel("feature"));
          const formLabel = result.system.featureForm ? featureFormLabel(result.system.featureForm) : featureFormLabel("passive");
          fullHtml += show(labels.actionType, formLabel);

          if (result.system.description) {
              const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
              fullHtml += `<div class="dh-preview-item success"><strong>${labels.description}:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
          }

      } else if (mode === "domainCard") {
          // DOMAIN CARD PREVIEW
          fullHtml += show(labels.type, itemTypeLabel("domainCard"));
          fullHtml += show(labels.domain, result.system.domain);
          fullHtml += show(labels.cardType, result.system.type);
          fullHtml += show(labels.level, result.system.level);
          fullHtml += show(labels.recallCost, result.system.recallCost);

          if (result.system.description) {
              const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
              fullHtml += `<div class="dh-preview-item success"><strong>${labels.description}:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
          }
      
      } else if (isItemMode) {
          // SIMPLE ITEM PREVIEW
          fullHtml += show(labels.type, itemTypeLabel(result.type));
          fullHtml += `<div class="dh-preview-item success"><strong>${labels.description}:</strong><br><em style="font-size:0.9em">${result.system.description}</em></div>`;
      } else {
          // ACTOR PREVIEW
          const data = result.systemData;
          const isEnvironment = result.actorType === "environment";

          fullHtml += show(labels.actorType, isEnvironment ? actorTypeLabel("environment") : actorTypeLabel("adversary"));
          fullHtml += show(labels.tier, data.tier);
          fullHtml += show(labels.type, isEnvironment ? environmentTypeLabel(data.type) : adversaryTypeLabel(data.type));
          if (data.type === "horde") fullHtml += show(labels.hordeHP, data.hordeHp);
          fullHtml += show(localizeKey("DAGGERHEART.ACTORS.Adversary.FIELDS.difficulty.label", localize("Fields.difficulty")), data.difficulty);

          if (!isEnvironment) {
             // ADVERSARY SPECIFIC FIELDS
             fullHtml += show(labels.hp, data.resources?.hitPoints?.max);
             fullHtml += show(labels.stress, data.resources?.stress?.max);

             // Damage Thresholds
             const threshStr = (data.damageThresholds?.major || data.damageThresholds?.severe)
                 ? `${data.damageThresholds.major || "?"}/${data.damageThresholds.severe || "?"}`
                 : null;
             fullHtml += show(labels.thresholds, threshStr);

             // Attack details - separate fields
             fullHtml += show(labels.attack, data.attack?.name);
             fullHtml += show(labels.range, data.attack?.range ? rangeLabel(data.attack.range) : null);
             fullHtml += show(labels.atkBonus, data.attack?.roll?.bonus);

             // Damage - dice and type separate
             let dmgDice = null;
             let dmgType = null;
             let hordeDmg = null;
             const attackParts = Object.values(data.attack?.damage?.parts ?? {});
             if (attackParts.length > 0) {
                 const part = attackParts[0];
                 const dmgVal = part.value;
                 if (dmgVal.custom?.enabled && dmgVal.custom?.formula) {
                     dmgDice = dmgVal.custom.formula;
                 } else if (dmgVal.dice) {
                     dmgDice = `${dmgVal.flatMultiplier > 1 ? dmgVal.flatMultiplier : ""}${dmgVal.dice}${dmgVal.bonus ? (dmgVal.bonus > 0 ? "+"+dmgVal.bonus : dmgVal.bonus) : ""}`;
                 }
                 if (part.type?.length > 0) dmgType = part.type.join("/");

                 // Horde Damage (valueAlt)
                 if (data.type === "horde" && part.valueAlt) {
                     const altVal = part.valueAlt;
                     if (altVal.custom?.enabled && altVal.custom?.formula) {
                         hordeDmg = altVal.custom.formula;
                     } else if (altVal.dice) {
                         hordeDmg = `${altVal.flatMultiplier > 1 ? altVal.flatMultiplier : ""}${altVal.dice}${altVal.bonus ? (altVal.bonus > 0 ? "+"+altVal.bonus : altVal.bonus) : ""}`;
                     }
                 }
             }
             fullHtml += show(labels.damage, dmgDice);
             fullHtml += show(labels.damageType, dmgType);
             if (data.type === "horde") fullHtml += show(labels.hordeDamage, hordeDmg);

             // Experiences
             const expEntries = Object.values(data.experiences || {});
             const expStr = expEntries.length > 0
                 ? expEntries.map(e => `${e.name} ${e.value >= 0 ? "+"+e.value : e.value}`).join(", ")
                 : null;
             fullHtml += show(labels.experience, expStr);

             // Motives & Tactics
             const motivesPreview = data.motivesAndTactics
                 ? (data.motivesAndTactics.length > 80 ? data.motivesAndTactics.substring(0, 80) + "..." : data.motivesAndTactics)
                 : null;
             fullHtml += show(labels.motives, motivesPreview);
          } else {
             // ENVIRONMENT SPECIFIC FIELDS
             const impulsesPreview = data.impulses
                 ? (data.impulses.length > 80 ? data.impulses.substring(0, 80) + "..." : data.impulses)
                 : null;
             fullHtml += show(labels.impulses, impulsesPreview);

             // Potential Adversaries - show each actor with (Compendium) or (New), same style as features
             const potAdvPreview = data._potentialAdvPreview || [];
             if (potAdvPreview.length > 0) {
                 // Group by label for display
                 const byLabel = {};
                 for (const item of potAdvPreview) {
                     if (!byLabel[item.label]) byLabel[item.label] = [];
                     byLabel[item.label].push(item);
                 }
                 fullHtml += `<div class="dh-preview-item success"><strong>${format("Importer.potentialAdversariesCount", { count: potAdvPreview.length })}:</strong></div>`;
                 for (const [label, actors] of Object.entries(byLabel)) {
                     fullHtml += `<div class="dh-preview-subitem" style="font-weight:bold; margin-top:4px;">— ${label}:</div>`;
                     for (const actor of actors) {
                         const sourceTag = actor.found
                             ? `<span style="color:#48bb48">(${localize("Common.compendium")})</span>`
                             : `<span style="color:#ffaa00">(${localize("Common.new")})</span>`;
                         fullHtml += `<div class="dh-preview-subitem">• ${actor.name} ${sourceTag}</div>`;
                     }
                 }
             } else if (data.notes) {
                 fullHtml += show(labels.potentialAdversaries, data.notes);
             }
          }

          // Description (both types)
          const descPreview = data.description
              ? (data.description.length > 100 ? data.description.substring(0, 100) + "..." : data.description)
              : null;
          fullHtml += show(labels.description, descPreview);

          // Features - one per line with source indicator
          if (result.items?.length > 0) {
              fullHtml += `<div class="dh-preview-item success"><strong>${format("Importer.featuresCount", { count: result.items.length })}:</strong></div>`;
              for (const item of result.items) {
                  const isCompendium = item.flags?.dhImporter?.isCompendium === true;
                  const sourceTag = isCompendium ? `<span style="color:#48bb48">(${localize("Common.compendium")})</span>` : `<span style="color:#ffaa00">(${localize("Common.new")})</span>`;
                  fullHtml += `<div class="dh-preview-subitem">• ${item.name} ${sourceTag}</div>`;
              }
          } else {
              fullHtml += show(labels.features, null);
          }
      }

      fullHtml += `</div></div>`; 
    }

    previewBox.innerHTML = fullHtml;

    const images = previewBox.querySelectorAll(".dh-preview-img");
    images.forEach(img => {
        img.addEventListener("click", ev => {
            const FilePickerClass = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;
            const fp = new FilePickerClass({
                type: "image",
                current: img.getAttribute("src"),
                callback: (path) => {
                    img.src = path;
                    img.style.borderColor = "#9cff2e";
                }
            });
            fp.render(true);
        });
    });
  }

  static async _onParse(event, target) {
    const formElement = this.element;
    const textarea = formElement.querySelector("textarea[name='statblockText']");
    const modeSelect = formElement.querySelector("select[name='importMode']");
    const previewBox = formElement.querySelector("#dh-importer-preview");

    if (!textarea || !textarea.value.trim()) {
      ui.notifications.warn(localize("Importer.emptyImport"));
      return;
    }

    const text = textarea.value.trim();
    const mode = modeSelect?.value || "adversary";
    const isItemMode = StatblockImporter.isItemMode(mode);

    let blocks = [];
    if (isItemMode) {
        blocks = StatblockImporter.splitSimpleItems(text);
    } else {
        blocks = StatblockImporter.splitStatblocks(text);
    }

    const totalBlocks = blocks.length;
    StatblockImporter.debugLog(`Starting import of ${totalBlocks} objects (${mode})`);

    const createdObjects = [];
    const failedBlocks = [];

    // --- FOLDER SETUP ---
    let targetFolder = null;

    try {
        if (isItemMode) {
            // 1. Find or Create ROOT Item Folder (Fixed Name/Color)
            const rootName = localize("Folders.importedItems");
            const rootColor = "#052e00";
            
            let rootFolder = game.folders.find(f => f.name === rootName && f.type === "Item");
            if (!rootFolder) {
                rootFolder = await Folder.create({ name: rootName, type: "Item", color: rootColor });
            }

            // 2. Determine Subfolder Settings based on Mode
            let settingKey = "";
            let defaultName = "";
            let fallbackPath = "";
            let color = "#333333";

            if (mode === "loot") {
                settingKey = "lootFolderName";
                fallbackPath = "Folders.importedLoot";
                defaultName = localize(fallbackPath);
                color = "#5c4600";
            } else if (mode === "consumable") {
                settingKey = "consumableFolderName";
                fallbackPath = "Folders.importedConsumables";
                defaultName = localize(fallbackPath);
                color = "#750027";
            } else if (mode === "weapon") {
                settingKey = "weaponFolderName";
                fallbackPath = "Folders.importedWeapons";
                defaultName = localize(fallbackPath);
                color = "#002b3d"; // Deep Blue/Teal
            } else if (mode === "armor") {
                settingKey = "armorFolderName";
                fallbackPath = "Folders.importedArmors";
                defaultName = localize(fallbackPath);
                color = "#3d2b00"; // Bronze/Brown
            } else if (mode === "feature") {
                settingKey = "featureFolderName";
                fallbackPath = "Folders.importedFeatures";
                defaultName = localize(fallbackPath);
                color = "#4a3d00"; // Gold/Yellow
            } else if (mode === "domainCard") {
                settingKey = "domainCardFolderName";
                fallbackPath = "Folders.importedDomainCards";
                defaultName = localize(fallbackPath);
                color = "#1e0047"; // Indigo/Purple
            }

            const subFolderName = settingKey
                ? StatblockImporter._folderSetting(settingKey, fallbackPath)
                : defaultName;
            const rawSubFolderName = settingKey
                ? StatblockImporter._rawFolderSetting(settingKey, fallbackPath)
                : null;
            
            // 3. Find or Create Subfolder (Parent = Root)
            targetFolder = await StatblockImporter._findOrCreateFolder({
                name: subFolderName,
                type: "Item",
                color,
                folder: rootFolder.id,
                legacyNames: [rawSubFolderName]
            });

        } else {
            // Actor Folder Logic (Existing)
            const advName = StatblockImporter._folderSetting("adversaryFolderName", "Folders.importedAdversaries");
            const envName = StatblockImporter._folderSetting("environmentFolderName", "Folders.importedEnvironments");
            const rawAdvName = StatblockImporter._rawFolderSetting("adversaryFolderName", "Folders.importedAdversaries");
            const rawEnvName = StatblockImporter._rawFolderSetting("environmentFolderName", "Folders.importedEnvironments");
            
            if (mode === "environment") {
                 targetFolder = await StatblockImporter._findOrCreateFolder({
                    name: envName,
                    type: "Actor",
                    color: "#2a3d00",
                    legacyNames: [rawEnvName]
                 });
            } else {
                 targetFolder = await StatblockImporter._findOrCreateFolder({
                    name: advName,
                    type: "Actor",
                    color: "#430047",
                    legacyNames: [rawAdvName]
                 });
            }
        }
    } catch (error) {
        StatblockImporter.errorLog(localize("Importer.failedFolders"), error);
        return;
    }

    const progressNotification = (blocks.length > 1)
        ? ui.notifications.info(format("Importer.importing", { current: 0, total: totalBlocks }), { progress: true })
        : null;

    // Accumulate features for batch creation (performance optimization)
    const pendingFeatures = [];

    // Accumulate features for +Code generator
    const collectedCodeFeatures = [];
    const codeGeneratorEnabled = game.settings.get(MODULE_ID, "codeGeneratorEnabled");

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (progressNotification) {
            progressNotification.update({ pct: (i + 1) / totalBlocks, message: format("Importer.importing", { current: i + 1, total: totalBlocks }) });
        }

        try {
            // Check for Custom Image in DOM
            let finalImg = null;
            if (previewBox) {
                const imgEl = previewBox.querySelector(`.dh-preview-img[data-idx="${i}"]`);
                if (imgEl) finalImg = imgEl.getAttribute("src");
            }

            if (isItemMode) {
                let result;
                if (mode === "weapon") {
                    result = StatblockImporter.parseWeaponData(block);
                } else if (mode === "armor") {
                    result = StatblockImporter.parseArmorData(block);
                } else if (mode === "feature") {
                    result = StatblockImporter.parseFeatureData(block);
                } else if (mode === "domainCard") {
                    result = StatblockImporter.parseDomainCardData(block);
                } else {
                    result = StatblockImporter.parseSimpleItemData(block, mode);
                }

                // +Code: Extract and collect feature if enabled
                if (codeGeneratorEnabled && (mode === "weapon" || mode === "armor") && result._featureText) {
                    const extracted = StatblockImporter.extractFeatureFromText(result._featureText);
                    if (extracted) {
                        collectedCodeFeatures.push({
                            mode: mode,
                            label: extracted.label,
                            description: extracted.description
                        });
                    }
                }

                // Remove internal property before creating item
                delete result._featureText;

                const itemData = {
                    name: result.name,
                    type: result.type,
                    system: result.system,
                    img: finalImg || result.img,
                    folder: targetFolder?.id
                };
                const newItem = await Item.create(itemData);
                if (newItem) createdObjects.push(newItem);

            } else {
                const result = await StatblockImporter.parseStatblockData(block, mode);
                
                let actorFolder = targetFolder;
                if (result.actorType === "environment") {
                    actorFolder = await StatblockImporter._ensureFolderHierarchy(
                        targetFolder,
                        result.systemData.type,
                        result.systemData.tier,
                        StatblockImporter.ENVIRONMENT_TYPE_COLORS
                    );
                } else {
                    actorFolder = await StatblockImporter._ensureFolderHierarchy(
                        targetFolder, 
                        result.systemData.type, 
                        result.systemData.tier,
                        StatblockImporter.TYPE_COLORS
                    );
                }

                // Default if not custom
                const defaultActorImg = result.actorType === "environment"
                    ? "icons/environment/wilderness/cave-entrance.webp"
                    : `modules/${MODULE_ID}/assets/images/skull.webp`;

                // Remove preview-only properties before creating actor
                const cleanSystemData = { ...result.systemData };
                delete cleanSystemData._potentialAdvPreview;

                // Determine portrait override for feature icon, if the matching option is active
                const isEnvironment = result.actorType === "environment";
                const matchAdversary = game.settings.get(MODULE_ID, "featureIconMatchAdversary");
                const matchEnvironment = game.settings.get(MODULE_ID, "featureIconMatchEnvironment");
                const usePortrait = isEnvironment ? matchEnvironment : matchAdversary;
                // Use the actor's actual portrait as the feature icon
                const portraitImg = usePortrait ? (finalImg || defaultActorImg) : null;

                // Apply portrait override to embedded items before actor creation
                if (portraitImg && result.items?.length > 0) {
                    for (const item of result.items) {
                        if (item.flags?.dhImporter?.isCompendium !== true) {
                            item.img = portraitImg;
                        }
                    }
                }

                const actorData = {
                    name: result.name,
                    type: result.actorType,
                    system: cleanSystemData,
                    items: result.items,
                    folder: actorFolder?.id,
                    img: finalImg || defaultActorImg
                };

                const newActor = await Actor.create(actorData);
                if (newActor) createdObjects.push(newActor);

                // +Features: Accumulate features for batch creation
                const plusFeaturesEnabled = game.settings.get(MODULE_ID, "plusFeaturesEnabled");
                if (plusFeaturesEnabled && result.items?.length > 0) {
                    const colorMap = isEnvironment ? StatblockImporter.ENVIRONMENT_TYPE_COLORS : StatblockImporter.TYPE_COLORS;

                    for (const featureItem of result.items) {
                        // Skip compendium features (they already exist)
                        if (featureItem.flags?.dhImporter?.isCompendium === true) continue;

                        // Determine feature type (action, reaction, passive)
                        const featureType = featureItem.system?.featureForm || "passive";

                        // Queue feature for batch creation
                        pendingFeatures.push({
                            featureItem,
                            isEnvironment,
                            actorType: result.systemData.type,
                            featureType,
                            colorMap,
                            portraitImg
                        });
                    }
                }
            }

        } catch (error) {
            const firstLine = block.split(/\r?\n/)[0] || localize("Common.unknown");
            failedBlocks.push({ index: i + 1, name: firstLine, error: error.message });
            StatblockImporter.errorLog(format("Importer.failedBlock", { index: i + 1 }), error);
        }
    }

    // Batch create all accumulated features
    if (pendingFeatures.length > 0) {
        if (progressNotification) {
            progressNotification.update({ pct: 0.95, message: format("Importer.creatingFeatures", { count: pendingFeatures.length }) });
        }

        try {
            // Cache folders to avoid repeated lookups
            const folderCache = new Map();

            // Prepare all feature data with folder IDs
            const featureDataArray = [];
            for (const pending of pendingFeatures) {
                const { featureItem, isEnvironment, actorType, featureType, colorMap, portraitImg } = pending;

                // Create cache key for folder lookup
                const cacheKey = `${isEnvironment}-${actorType}-${featureType}`;

                // Get or create folder
                let featureFolder = folderCache.get(cacheKey);
                if (!featureFolder) {
                    featureFolder = await StatblockImporter._ensureFeatureFolderHierarchy(
                        isEnvironment,
                        actorType,
                        featureType,
                        colorMap
                    );
                    folderCache.set(cacheKey, featureFolder);
                }

                featureDataArray.push({
                    name: featureItem.name,
                    type: featureItem.type,
                    system: featureItem.system,
                    // Portrait override takes priority; featureItem.img already reflects the icon settings
                    img: portraitImg || featureItem.img,
                    folder: featureFolder?.id
                });
            }

            // Batch create all features at once
            const createdFeatures = await Item.createDocuments(featureDataArray);
            StatblockImporter.debugLog(`+Features: Batch created ${createdFeatures.length} features`);
        } catch (batchError) {
            StatblockImporter.errorLog(`+Features: Batch creation failed`, batchError);
            ui.notifications.error(localize("Importer.failedFeatures"));
        }
    }

    if (progressNotification) progressNotification.update({ pct: 1, message: localize("Importer.importComplete") });

    if (createdObjects.length > 0) {
        if (blocks.length > 1) ui.notifications.info(format("Importer.importedObjects", { count: createdObjects.length }));
        if (createdObjects.length === 1 && !blocks.length > 1) createdObjects[0].sheet.render(true);
    }

    // +Code: Show feature code dialog if features were collected
    if (collectedCodeFeatures.length > 0 && codeGeneratorEnabled) {
        new FeatureCodeDialog({ features: collectedCodeFeatures }).render(true);
    }

    if (failedBlocks.length > 0) {
        ui.notifications.warn(format("Importer.failedItems", { count: failedBlocks.length }));
    }
  }

  /**
   * Extracts feature label and description from text if it matches "FeatureName: Description" pattern
   * @param {string} featureText - The text to analyze
   * @returns {Object|null} - {label: string, description: string} or null if no match
   */
  static extractFeatureFromText(featureText) {
      if (!featureText || !featureText.trim()) return null;

      // Regex to detect "Name: Description" pattern
      const featurePattern = /^([^:]+):\s*(.+)$/;
      const match = featureText.match(featurePattern);

      if (!match) return null;

      const label = match[1].trim();
      const description = match[2].trim();

      // Basic validation: label should have at least 2 characters
      if (label.length < 2) return null;

      return { label, description };
  }

  /**
   * Helper to ensure the folder hierarchy (Type -> Tier) exists inside the root folder.
   */
  static async _ensureFolderHierarchy(rootFolder, type, tier, colorMap) {
      const isEnvironment = colorMap === StatblockImporter.ENVIRONMENT_TYPE_COLORS;
      const normalizedType = type ? String(type).toLowerCase() : "unknown";
      
      const colorKey = titleCase(normalizedType);
      const typeKey = type
          ? (isEnvironment ? environmentTypeLabel(normalizedType) : adversaryTypeLabel(normalizedType))
          : localize("Common.unknown");
      const color = colorMap[colorKey] || colorMap["Unknown"] || "#333333";

      let typeFolder = game.folders.find(f => f.name === typeKey && f.type === "Actor" && f.folder?.id === rootFolder.id);
      
      if (!typeFolder) {
          typeFolder = await Folder.create({
              name: typeKey,
              type: "Actor",
              folder: rootFolder.id,
              color: color,
              sorting: "a"
          });
      }

      const tierName = format("Folders.tier", { tier });
      let tierFolder = game.folders.find(f => f.name === tierName && f.type === "Actor" && f.folder?.id === typeFolder.id);
      
      if (!tierFolder) {
          tierFolder = await Folder.create({
              name: tierName,
              type: "Actor",
              folder: typeFolder.id,
              sorting: "a"
          });
      }

      return tierFolder;
  }

  /**
   * Helper to ensure the folder hierarchy for +Features mode exists.
   * Structure: 📦 Imported Items / ✨ {Adversary|Environment} Features / {ActorType} / {FeatureType}
   * @param {boolean} isEnvironment - Whether this is an environment or adversary
   * @param {string} actorType - The type of the actor (e.g., "bruiser", "leader", "event", "traversal")
   * @param {string} featureType - The type of the feature (e.g., "action", "reaction", "passive")
   * @param {Object} colorMap - The color map to use for folder colors
   * @returns {Folder} - The target folder for the feature
   */
  static async _ensureFeatureFolderHierarchy(isEnvironment, actorType, featureType, colorMap) {
      // 1. Find or Create ROOT Item Folder
      const rootName = localize("Folders.importedItems");
      const rootColor = "#052e00";

      let rootFolder = game.folders.find(f => f.name === rootName && f.type === "Item");
      if (!rootFolder) {
          rootFolder = await Folder.create({ name: rootName, type: "Item", color: rootColor });
      }

      // 2. Find or Create Category Folder (Adversary Features or Environment Features)
      const categoryName = isEnvironment ? localize("Folders.environmentFeatures") : localize("Folders.adversaryFeatures");
      const categoryColor = isEnvironment ? "#0f3d0f" : "#4a3d00";

      let categoryFolder = game.folders.find(f => f.name === categoryName && f.type === "Item" && f.folder?.id === rootFolder.id);
      if (!categoryFolder) {
          categoryFolder = await Folder.create({
              name: categoryName,
              type: "Item",
              folder: rootFolder.id,
              color: categoryColor
          });
      }

      // 3. If no actorType provided, return category folder
      if (!actorType) return categoryFolder;

      // 4. Find or Create Actor Type Folder
      const normalizedActorType = String(actorType).toLowerCase();
      const colorKey = titleCase(normalizedActorType);
      const typeKey = isEnvironment ? environmentTypeLabel(normalizedActorType) : adversaryTypeLabel(normalizedActorType);
      const typeColor = colorMap[colorKey] || colorMap["Unknown"] || "#333333";

      let typeFolder = game.folders.find(f => f.name === typeKey && f.type === "Item" && f.folder?.id === categoryFolder.id);
      if (!typeFolder) {
          typeFolder = await Folder.create({
              name: typeKey,
              type: "Item",
              folder: categoryFolder.id,
              color: typeColor
          });
      }

      // 5. If no featureType provided, return type folder
      if (!featureType) return typeFolder;

      // 6. Find or Create Feature Type Folder (Action, Reaction, Passive)
      const featureTypeKey = featureFormLabel(featureType);

      let featureTypeFolder = game.folders.find(f => f.name === featureTypeKey && f.type === "Item" && f.folder?.id === typeFolder.id);
      if (!featureTypeFolder) {
          featureTypeFolder = await Folder.create({
              name: featureTypeKey,
              type: "Item",
              folder: typeFolder.id
          });
      }

      return featureTypeFolder;
  }

  /* -------------------------------------------- */
  /* Splitter Logic                              */
  /* -------------------------------------------- */

  /**
   * Detects and splits multiple statblocks (Actors) based on "Tier X".
   */
  static splitStatblocks(text) {
    const separatorMode = game.settings.get(MODULE_ID, "separatorMode") || "blankLine";
    text = StatblockImporter._normalizeActorStatblockText(text);

    // If using === separator, split by that first
    if (separatorMode === "separator") {
        return text.split(/^===$/m).map(t => t.trim()).filter(t => t.length > 0);
    }

    // Default: detect by Tier line pattern
    const lines = text.split(/\r?\n/);
    const tierRegex = /^Tier\s+\d+\s+\S+(?:\s*\(\d+\/HP\))?$/i;
    const tierIndices = [];
    for (let i = 0; i < lines.length; i++) {
      if (tierRegex.test(lines[i].trim())) tierIndices.push(i);
    }

    if (tierIndices.length <= 1) return [text];

    const blocks = [];
    for (let i = 0; i < tierIndices.length; i++) {
      const nameLineIndex = tierIndices[i] - 1;
      const startIndex = nameLineIndex >= 0 ? nameLineIndex : tierIndices[i];
      const endIndex = (i + 1 < tierIndices.length) ? tierIndices[i + 1] - 1 : lines.length;
      const blockLines = lines.slice(startIndex, endIndex);
      const blockText = blockLines.join("\n").trim();
      if (blockText.length > 0) blocks.push(blockText);
    }
    return blocks;
  }

  static _normalizeActorStatblockText(text) {
      if (!text) return text;

      const cleaned = TextNormalizer.clean(text);
      let inFeatures = false;

      return cleaned
          .split("\n")
          .map(line => {
              const actorLine = StatblockImporter._normalizeActorStatblockLine(line);
              if (/^Tier\s+\d+\s+/i.test(actorLine)) inFeatures = false;
              if (/^FEATURES:?$/i.test(actorLine)) {
                  inFeatures = true;
                  return actorLine;
              }
              return inFeatures ? StatblockImporter._normalizeFeatureStatblockLine(line) : actorLine;
          })
          .join("\n")
          .trim();
  }

  static _normalizeActorStatblockLine(line) {
      let normalized = StatblockImporter._stripStatblockMarkdown(line);
      if (!normalized) return normalized;

      const sectionKey = StatblockImporter._parserKey(normalized).replace(/:$/, "");
      if (StatblockImporter._matchesParserPattern(sectionKey, "sections.features", "features")) {
          return "FEATURES";
      }

      normalized = normalized.replace(/^Tier\s+(\d+)\s*,\s*/i, "Tier $1 ");

      const tierMatch = normalized.match(StatblockImporter._parserRegex("actor.tierLine", "^Tier\\s+(\\d+)\\s*,?\\s*(.+)$"));
      if (tierMatch) {
          let rawType = tierMatch[2].trim();
          let hordeHp = null;
          const hordeMatch = rawType.match(StatblockImporter._parserRegex("actor.hordeHp", "^(.+?)\\s*\\(\\s*(\\d+)\\s*\\/\\s*(?:HP)\\s*\\)$"));
          if (hordeMatch) {
              rawType = hordeMatch[1].trim();
              hordeHp = hordeMatch[2];
          }

          const canonicalType = StatblockImporter._canonicalActorStatblockType(rawType);
          return hordeHp
              ? `Tier ${tierMatch[1]} ${canonicalType} (${hordeHp}/HP)`
              : `Tier ${tierMatch[1]} ${canonicalType}`;
      }

      normalized = StatblockImporter._replaceLocalizedStatLabels(normalized);
      normalized = StatblockImporter._replaceLocalizedFeatureForms(normalized);

      const statLikeLine = normalized.includes("|")
          || /^(?:Difficulty|Thresholds|HP|Stress|ATK|Experience):/i.test(normalized)
          || StatblockImporter._isLocalizedRangeSegment(normalized)
          || /^\d*d\d+(?:\s*[+-]\s*\d+)?\s+/i.test(normalized)
          || /^\d+\s+/.test(normalized);

      if (statLikeLine) {
          normalized = StatblockImporter._replaceLocalizedRanges(normalized);
          normalized = StatblockImporter._replaceLocalizedDamageTypes(normalized);
      }

      return normalized.replace(/[ \t]+/g, " ").trim();
  }

  static _stripStatblockMarkdown(line) {
      return String(line ?? "")
          .replace(/^#{1,6}\s*/, "")
          .replace(/^\s*[-*+]\s+/, "")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/\*\*([^*]+)\*\*/g, "$1")
          .replace(/__([^_]+)__/g, "$1")
          .replace(/\*([^*]+)\*/g, "$1")
          .trim();
  }

  static _parserPattern(path, fallback) {
      return localizeKey(moduleKey(`Parser.${path}`), fallback);
  }

  static _parserRegex(path, fallback, flags = "i") {
      return new RegExp(StatblockImporter._parserPattern(path, fallback), flags);
  }

  static _parserKey(value) {
      return String(value ?? "")
          .toLowerCase()
          .replace(/\u0451/g, "\u0435")
          .replace(/\./g, "")
          .trim();
  }

  static _matchesParserPattern(value, path, fallback) {
      const pattern = StatblockImporter._parserPattern(path, fallback);
      return new RegExp(`^(?:${pattern})$`, "i").test(StatblockImporter._parserKey(value));
  }

  static _normalizeFeatureStatblockLine(line) {
      const normalized = String(line ?? "").trim();
      if (!normalized) return normalized;

      const withoutBullet = normalized.replace(/^\s*[-*+]\s+/, "");
      const header = StatblockImporter._parseFeatureHeaderLine(withoutBullet);
      if (!header) return normalized;

      return `${header.name} - ${header.form}${header.description ? `: ${header.description}` : ""}`;
  }

  static _parseFeatureHeaderLine(line) {
      const boldHeaderMatch = line.match(/^(?:\*\*|__)(.+?)\s*-\s*([^*_]+?)\s*:?(?:\*\*|__)\s*:?\s*(.*)$/i);
      const plainHeaderMatch = line.match(/^(.+?)\s*-\s*([^:]+?)(?::\s*(.*))?$/i);
      const match = boldHeaderMatch || plainHeaderMatch;
      if (!match) return null;

      const form = StatblockImporter._canonicalFeatureForm(match[2]);
      if (!form) return null;

      return {
          name: StatblockImporter._stripStatblockMarkdown(match[1]),
          form,
          description: (match[3] || "").trim()
      };
  }

  static _canonicalFeatureForm(form) {
      const value = StatblockImporter._stripStatblockMarkdown(form);
      const forms = [
          ["Action", "featureForms.action", "action"],
          ["Reaction", "featureForms.reaction", "reaction"],
          ["Passive", "featureForms.passive", "passive"]
      ];

      return forms.find(([, path, fallback]) => StatblockImporter._matchesParserPattern(value, path, fallback))?.[0] || null;
  }

  static _canonicalActorStatblockType(type) {
      const types = [
          ["Bruiser", "actorTypes.bruiser", "bruiser"],
          ["Horde", "actorTypes.horde", "horde"],
          ["Leader", "actorTypes.leader", "leader"],
          ["Minion", "actorTypes.minion", "minion"],
          ["Ranged", "actorTypes.ranged", "ranged"],
          ["Skulk", "actorTypes.skulk", "skulk"],
          ["Social", "actorTypes.social", "social"],
          ["Solo", "actorTypes.solo", "solo"],
          ["Standard", "actorTypes.standard", "standard"],
          ["Support", "actorTypes.support", "support"],
          ["Exploration", "actorTypes.exploration", "exploration"],
          ["Traversal", "actorTypes.traversal", "traversal"],
          ["Event", "actorTypes.event", "event"]
      ];

      return types.find(([, path, fallback]) => StatblockImporter._matchesParserPattern(type, path, fallback))?.[0] || titleCase(type);
  }

  static _replaceLocalizedStatLabels(line) {
      const replacements = [
          ["labels.motives", "Motives & Tactics:", "Motives\\s*(?:&|and)\\s*Tactics"],
          ["labels.impulses", "Impulses:", "Impulses"],
          ["labels.potentialAdversaries", "Potential Adversaries:", "Potential\\s+Adversaries"],
          ["labels.difficulty", "Difficulty:", "Difficulty"],
          ["labels.thresholds", "Thresholds:", "Thresholds"],
          ["labels.hitPoints", "HP:", "HP"],
          ["labels.stress", "Stress:", "Stress"],
          ["labels.attackModifier", "ATK:", "ATK"],
          ["labels.experience", "Experience:", "Experience"]
      ];

      return replacements.reduce((current, [path, replacement, fallback]) => {
          const pattern = StatblockImporter._parserPattern(path, fallback);
          return current.replace(new RegExp(`(\\||^)\\s*(?:${pattern})\\s*:`, "gi"), `$1 ${replacement}`);
      }, line);
  }

  static _replaceLocalizedFeatureForms(line) {
      const forms = [
          ["featureForms.action", "Action", "action"],
          ["featureForms.reaction", "Reaction", "reaction"],
          ["featureForms.passive", "Passive", "passive"]
      ];

      return forms.reduce((current, [path, replacement, fallback]) => {
          const pattern = StatblockImporter._parserPattern(path, fallback);
          return current.replace(new RegExp(`\\s*-\\s*(?:${pattern})\\s*:`, "i"), ` - ${replacement}:`);
      }, line);
  }

  static _replaceLocalizedRanges(line) {
      const replacements = [
          ["ranges.veryFar", "Very Far", "very\\s+far"],
          ["ranges.veryClose", "Very Close", "very\\s+close"],
          ["ranges.melee", "Melee", "melee"],
          ["ranges.close", "Close", "close"],
          ["ranges.far", "Far", "far"]
      ];

      return replacements.reduce((current, [path, replacement, fallback]) => {
          const pattern = StatblockImporter._parserPattern(path, fallback);
          return current.replace(new RegExp(pattern, "gi"), replacement);
      }, line);
  }

  static _replaceLocalizedDamageTypes(line) {
      return line
          .replace(new RegExp(`(^|[\\s|,;])(?:${StatblockImporter._parserPattern("damageTypes.physical", "phy|physical")})(?=$|[\\s|,;.])`, "gi"), "$1phy")
          .replace(new RegExp(`(^|[\\s|,;])(?:${StatblockImporter._parserPattern("damageTypes.magical", "mag|magical")})(?=$|[\\s|,;.])`, "gi"), "$1mag");
  }

  static _isLocalizedRangeSegment(line) {
      const rangePattern = ["ranges.veryFar", "ranges.veryClose", "ranges.melee", "ranges.close", "ranges.far"]
          .map(path => StatblockImporter._parserPattern(path, ""))
          .filter(Boolean)
          .join("|");
      return new RegExp(`^.+:\\s*(?:${rangePattern})$`, "i").test(line);
  }

  static _detectedActionName(kind, value = null, formula = null) {
      switch (kind) {
          case "attack":
              return localizeKey("DAGGERHEART.ACTIONS.TYPES.attack.name", localize("Actions.attack"));
          case "damage":
              return format("Actions.damageFormula", { formula });
          case "gainFear":
              return value === 1
                  ? localize("Actions.gainFear")
                  : format("Actions.gainFearValue", { value });
          case "markStress":
              return value === 1
                  ? localize("Actions.markStress")
                  : format("Actions.markStressValue", { value });
          case "clearHitPoints":
              return value === 1
                  ? localize("Actions.clearHitPoints")
                  : format("Actions.clearHitPointsValue", { value });
          case "clearStress":
              return value === 1
                  ? localize("Actions.clearStress")
                  : format("Actions.clearStressValue", { value });
          case "clearHitPointsAndStress":
              return value === 1
                  ? localize("Actions.clearHitPointsAndStress")
                  : format("Actions.clearHitPointsAndStressValue", { value });
          case "spendFear":
              return value === 1
                  ? localize("Actions.spendFear")
                  : format("Actions.spendFearValue", { value });
          case "spendHope":
              return value === 1
                  ? localize("Actions.spendHope")
                  : format("Actions.spendHopeValue", { value });
          case "loseHope":
              return value === 1
                  ? localize("Actions.loseHope")
                  : format("Actions.loseHopeValue", { value });
          default:
              return titleCase(kind);
      }
  }

  static _resourceValueFromMatch(match) {
      if (!match) return 1;
      const value = String(match).toLowerCase();
      if (StatblockImporter._matchesParserPattern(value, "numbers.one", "a|an|one")) return 1;
      return parseInt(value, 10) || 1;
  }

  static _createHealingAction(name, parts, options = {}) {
      const actionId = foundry.utils.randomID(16);
      return {
          type: "healing",
          _id: actionId,
          systemPath: "actions",
          baseAction: false,
          description: "",
          chatDisplay: true,
          originItem: { type: "itemCollection" },
          actionType: "action",
          triggers: [],
          cost: [],
          uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
          damage: { parts },
          target: { type: options.target ?? "self", amount: options.amount ?? null },
          effects: [],
          name,
          range: ""
      };
  }

  static _healingPart(resource, formula) {
      return {
          applyTo: resource,
          value: {
              custom: {
                  enabled: true,
                  formula: String(formula)
              }
          }
      };
  }

  static _detectClearResourceActions(searchText) {
      const actions = [];
      const clearVerb = StatblockImporter._parserRegex("actions.clearVerb", "clear|heal|recover|remove");
      const hpRegex = StatblockImporter._parserRegex("resources.hitPoints", "\\b(?:hit\\s*points?|hp)\\b", "iu");
      const stressRegex = StatblockImporter._parserRegex("resources.stress", "\\bstress\\b");

      const clauses = String(searchText ?? "")
          .split(/(?<=[.!?;])\s+/)
          .map(clause => clause.trim())
          .filter(Boolean);

      for (const clause of clauses) {
          if (!clearVerb.test(clause)) continue;

          const hasHitPoints = hpRegex.test(clause);
          const hasStress = stressRegex.test(clause);
          if (!hasHitPoints && !hasStress) continue;

          const fullClear = StatblockImporter._parserRegex("actions.fullClear", "\\b(?:all|fully)\\b").test(clause);
          const valueMatch = clause.match(new RegExp(`\\b(\\d+|${StatblockImporter._parserPattern("numbers.one", "a|an|one")})\\b`, "i"));
          const value = fullClear ? null : StatblockImporter._resourceValueFromMatch(valueMatch?.[1]);
          const formulaFor = resource => fullClear ? `@system.resources.${resource}.max` : value;
          const isChoice = StatblockImporter._parserRegex("actions.choice", "\\bor\\b").test(clause);

          if (hasHitPoints && hasStress && !isChoice) {
              const name = fullClear
                  ? localize("Actions.clearHitPointsAndStressAll")
                  : StatblockImporter._detectedActionName("clearHitPointsAndStress", value);
              actions.push(StatblockImporter._createHealingAction(name, {
                  hitPoints: StatblockImporter._healingPart("hitPoints", formulaFor("hitPoints")),
                  stress: StatblockImporter._healingPart("stress", formulaFor("stress"))
              }));
              continue;
          }

          if (hasHitPoints) {
              const name = fullClear
                  ? localize("Actions.clearHitPointsAll")
                  : StatblockImporter._detectedActionName("clearHitPoints", value);
              actions.push(StatblockImporter._createHealingAction(name, {
                  hitPoints: StatblockImporter._healingPart("hitPoints", formulaFor("hitPoints"))
              }));
          }

          if (hasStress) {
              const name = fullClear
                  ? localize("Actions.clearStressAll")
                  : StatblockImporter._detectedActionName("clearStress", value);
              actions.push(StatblockImporter._createHealingAction(name, {
                  stress: StatblockImporter._healingPart("stress", formulaFor("stress"))
              }));
          }
      }

      return actions;
  }

  static _formatFeatureDescriptionHtml(description) {
      if (!description) return "";

      const paragraphs = String(description)
          .replace(/<\/p>\s*<p>/gi, "\n")
          .split(/\n+|<\/p>/i)
          .map(part => part.replace(/^<p>/i, "").trim())
          .filter(part => part.length > 0);

      const htmlParts = [];
      let listItems = [];

      const flushList = () => {
          if (listItems.length === 0) return;
          htmlParts.push(`<ul>${listItems.join("")}</ul>`);
          listItems = [];
      };

      for (const paragraph of paragraphs) {
          const bulletMatch = paragraph.match(/^(?:[-*]|\u2022)\s+(.*)$/);
          if (bulletMatch) {
              listItems.push(`<li>${StatblockImporter._markdownInlineToHtml(bulletMatch[1].trim())}</li>`);
              continue;
          }

          flushList();
          htmlParts.push(`<p>${StatblockImporter._markdownInlineToHtml(paragraph)}</p>`);
      }

      flushList();
      return htmlParts.join("");
  }

  static _markdownInlineToHtml(text) {
      return String(text ?? "")
          .replace(/`([^`]+)`/g, "<code>$1</code>")
          .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
          .replace(/__([^_]+)__/g, "<strong>$1</strong>")
          .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,;:!?])/g, "$1<em>$2</em>")
          .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,;:!?])/g, "$1<em>$2</em>");
  }

  static _plainTextForActionDetection(text) {
      return String(text ?? "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim();
  }

  /**
   * Detects and splits multiple Items based on separator mode.
   */
  static splitSimpleItems(text) {
      text = TextNormalizer.clean(text);
      const separatorMode = game.settings.get(MODULE_ID, "separatorMode") || "blankLine";

      if (separatorMode === "separator") {
          // Split by === separator
          return text.split(/^===$/m).map(t => t.trim()).filter(t => t.length > 0);
      }

      // Default: split by double newlines (one or more empty lines in between text)
      return text.split(/\n\s*\n/).map(t => t.trim()).filter(t => t.length > 0);
  }

  /* -------------------------------------------- */
  /* Parsing Logic                               */
  /* -------------------------------------------- */

  /**
   * Wraps dice rolls in [[/r ]] format for Foundry inline rolls.
   * Handles formats like: 1d6, 2d8+3, 1d4-1, 3d4 + 8, 3d4+ 8, 3d4 +8
   * @param {string} text - The text to process
   * @returns {string} - Text with dice rolls wrapped in [[/r ]]
   */
  static wrapDiceRolls(text) {
      if (!text) return text;
      // First handle dice with modifiers (with optional spaces)
      let result = text.replace(/\b(\d+d\d+)\s*([+-])\s*(\d+)\b/g, '[[/r $1$2$3]]');
      // Then handle plain dice (only if not followed by +/- which would have been caught above)
      result = result.replace(/\b(\d+d\d+)\b(?!\s*[+-])/g, '[[/r $1]]');
      return result;
  }

  /**
   * Detects actions in a description text and returns an actions object.
   * This function is used by features, loot, consumables, weapons, armors, and domain cards.
   * @param {string} description - The description text to analyze
   * @returns {Object} - An object containing detected actions keyed by random IDs
   */
  static detectActionsInDescription(description) {
      const detectedActions = {};
      const searchText = StatblockImporter._plainTextForActionDetection(description);

      // Detect "Gain Fear" / "Gain 1 Fear" and common Russian equivalents.
      const gainFearMatch = searchText.match(StatblockImporter._parserRegex("actions.gainFear", "(?:gain|receive|get)\\s+(?:a\\s+|one\\s+|(\\d+)\\s+)?fear"));
      if (gainFearMatch) {
          const fearValue = gainFearMatch[1] ? parseInt(gainFearMatch[1], 10) : 1;
          const fearName = StatblockImporter._detectedActionName("gainFear", fearValue);
          const fearAction = StatblockImporter._createHealingAction(fearName, {
              fear: StatblockImporter._healingPart("fear", fearValue)
          });
          detectedActions[fearAction._id] = fearAction;
      }

      // Detect "Mark Stress" / "Mark 1 Stress" and common Russian equivalents.
      const stressMatch = searchText.match(StatblockImporter._parserRegex("actions.markStress", "(?:mark|spend)\\s+(?:a\\s+|one\\s+|(\\d+)\\s+)?stress"));
      if (stressMatch) {
          const stressValue = stressMatch[1] ? parseInt(stressMatch[1], 10) : 1;
          const stressName = StatblockImporter._detectedActionName("markStress", stressValue);
          const actionId = foundry.utils.randomID(16);
          detectedActions[actionId] = {
              type: "effect",
              _id: actionId,
              systemPath: "actions",
              baseAction: false,
              description: "",
              chatDisplay: true,
              originItem: { type: "itemCollection" },
              actionType: "action",
              triggers: [],
              areas: [],
              cost: [{
                  scalable: false,
                  key: "stress",
                  value: stressValue,
                  itemId: null,
                  step: null,
                  consumeOnSuccess: false
              }],
              uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
              effects: [],
              target: { type: "any", amount: null },
              name: stressName,
              range: ""
          };
      }

      // Detect "Spend Fear" / "Spend 1 Fear" and common Russian equivalents.
      const fearMatch = searchText.match(StatblockImporter._parserRegex("actions.spendFear", "spend\\s+(?:a\\s+|one\\s+|(\\d+)\\s+)?fear"));
      if (fearMatch) {
          const fearValue = fearMatch[1] ? parseInt(fearMatch[1], 10) : 1;
          const fearName = StatblockImporter._detectedActionName("spendFear", fearValue);
          const actionId = foundry.utils.randomID(16);
          detectedActions[actionId] = {
              type: "effect",
              _id: actionId,
              systemPath: "actions",
              baseAction: false,
              description: "",
              chatDisplay: true,
              originItem: { type: "itemCollection" },
              actionType: "action",
              triggers: [],
              areas: [],
              cost: [{
                  scalable: false,
                  key: "fear",
                  value: fearValue,
                  itemId: null,
                  step: null,
                  consumeOnSuccess: false
              }],
              uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
              effects: [],
              target: { type: "any", amount: null },
              name: fearName,
              range: ""
          };
      }

      // Detect "Spend Hope" / "Spend 1 Hope" and common Russian equivalents.
      const hopeMatch = searchText.match(StatblockImporter._parserRegex("actions.spendHope", "spend\\s+(?:a\\s+|one\\s+|(\\d+)\\s+)?hope"));
      if (hopeMatch) {
          const hopeValue = hopeMatch[1] ? parseInt(hopeMatch[1], 10) : 1;
          const hopeName = StatblockImporter._detectedActionName("spendHope", hopeValue);
          const actionId = foundry.utils.randomID(16);
          detectedActions[actionId] = {
              type: "effect",
              _id: actionId,
              systemPath: "actions",
              baseAction: false,
              description: "",
              chatDisplay: true,
              originItem: { type: "itemCollection" },
              actionType: "action",
              triggers: [],
              areas: [],
              cost: [{
                  scalable: false,
                  key: "hope",
                  value: hopeValue,
                  itemId: null,
                  step: null,
                  consumeOnSuccess: false
              }],
              uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
              effects: [],
              target: { type: "any", amount: null },
              name: hopeName,
              range: ""
          };
      }

      // Detect localized lose-hope patterns.
      const loseHopeMatch = searchText.match(StatblockImporter._parserRegex("actions.loseHope", "(?!)"));
      if (loseHopeMatch) {
          const hopeValue = loseHopeMatch[1] ? parseInt(loseHopeMatch[1], 10) : 1;
          const hopeName = StatblockImporter._detectedActionName("loseHope", hopeValue);
          const actionId = foundry.utils.randomID(16);
          detectedActions[actionId] = {
              type: "effect",
              _id: actionId,
              systemPath: "actions",
              baseAction: false,
              description: "",
              chatDisplay: true,
              originItem: { type: "itemCollection" },
              actionType: "action",
              triggers: [],
              cost: [{
                  scalable: false,
                  key: "hope",
                  value: hopeValue,
                  itemId: null,
                  step: null,
                  consumeOnSuccess: false
              }],
              uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
              effects: [],
              target: { type: "any", amount: null },
              name: hopeName,
              range: ""
          };
      }

      for (const clearAction of StatblockImporter._detectClearResourceActions(searchText)) {
          detectedActions[clearAction._id] = clearAction;
      }

      // Detect "TRAIT Reaction Roll" patterns (e.g., "Strength Reaction Roll", "Agility Reaction Roll")
      const traits = ["Strength", "Instinct", "Knowledge", "Finesse", "Presence", "Agility"];
      for (const trait of traits) {
          const reactionRollRegex = new RegExp(`${trait}\\s+Reaction\\s+Roll`, "i");
          if (reactionRollRegex.test(searchText)) {
              const actionId = foundry.utils.randomID(16);
              detectedActions[actionId] = {
                  type: "attack",
                  _id: actionId,
                  systemPath: "actions",
                  baseAction: false,
                  description: "",
                  chatDisplay: true,
                  originItem: { type: "itemCollection" },
                  actionType: "action",
                  triggers: [],
                  areas: [],
                  cost: [],
                  uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
                  damage: {
                      parts: {},
                      includeBase: false,
                      direct: false
                  },
                  target: { type: "any", amount: null },
                  effects: [],
                  roll: {
                      type: null,
                      trait: null,
                      difficulty: null,
                      bonus: null,
                      advState: "neutral",
                      diceRolling: {
                          multiplier: "prof",
                          flatMultiplier: 1,
                          dice: "d6",
                          compare: null,
                          treshold: null
                      },
                      useDefault: false
                  },
                  save: {
                      trait: trait.toLowerCase(),
                      difficulty: null,
                      damageMod: "none"
                  },
                  name: `${trait} Reaction Roll`,
                  range: ""
              };
          }
      }

      // Detect "make an attack" / "make a standard attack" / "make an attack roll"
      if (StatblockImporter._parserRegex("actions.attack", "make\\s+(an?\\s+)?(standard\\s+)?attack(\\s+roll)?").test(searchText)) {
          const actionId = foundry.utils.randomID(16);
          detectedActions[actionId] = {
              type: "attack",
              _id: actionId,
              systemPath: "actions",
              baseAction: false,
              description: "",
              chatDisplay: true,
              originItem: { type: "itemCollection" },
              actionType: "action",
              triggers: [],
              areas: [],
              cost: [],
              uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
              damage: {
                  parts: {},
                  includeBase: false,
                  direct: false
              },
              target: { type: "any", amount: null },
              effects: [],
              roll: {
                  type: "attack",
                  trait: null,
                  difficulty: null,
                  bonus: null,
                  advState: "neutral",
                  diceRolling: {
                      multiplier: "prof",
                      flatMultiplier: 1,
                      dice: "d6",
                      compare: null,
                      treshold: null
                  },
                  useDefault: false
              },
              save: {
                  trait: null,
                  difficulty: null,
                  damageMod: "none"
              },
              name: StatblockImporter._detectedActionName("attack"),
              range: ""
          };
      }

      // Detect damage dice patterns only when in damage context
      // Check if text mentions "damage" at all (with or without type specifier)
      const hasDamageContext = StatblockImporter._parserRegex("actions.damageContext", "\\bdamage\\b").test(searchText);

      if (hasDamageContext) {
          // Detect damage type and direct flag
          // Default: physical, direct: false
          let damageType = ["physical"];
          let isDirect = false;

          if (StatblockImporter._parserRegex("actions.directMagicalDamage", "direct\\s+(?:magic|magical)\\s+damage").test(searchText)) {
              damageType = ["magical"];
              isDirect = true;
          } else if (StatblockImporter._parserRegex("actions.directPhysicalDamage", "direct\\s+physical\\s+damage").test(searchText)) {
              damageType = ["physical"];
              isDirect = true;
          } else if (StatblockImporter._parserRegex("actions.directDamage", "direct\\s+damage").test(searchText)) {
              // "direct damage" without type = physical + direct
              damageType = ["physical"];
              isDirect = true;
          } else if (StatblockImporter._parserRegex("actions.magicalDamage", "(?:magic|magical)\\s+damage").test(searchText)) {
              damageType = ["magical"];
          } else if (StatblockImporter._parserRegex("actions.physicalDamage", "physical\\s+damage").test(searchText)) {
              damageType = ["physical"];
          }
          // If just "damage" without type, defaults remain: physical, direct: false

          // Pattern: XdY or XdY+Z with optional spaces, with or without [[/r ]] wrapper
          const diceRegex = /(?:\[\[\/r\s+)?(\d+d\d+)(?:\s*([+-])\s*(\d+))?(?:\]\])?/g;
          const diceMatches = searchText.matchAll(diceRegex);

          for (const match of diceMatches) {
              const diceBase = match[1]; // e.g., "1d10"
              const sign = match[2] || ""; // e.g., "+" or "-"
              const modifier = match[3] || ""; // e.g., "3"
              const formula = sign && modifier ? `${diceBase}${sign}${modifier}` : diceBase;

              const actionId = foundry.utils.randomID(16);
              detectedActions[actionId] = {
                  type: "damage",
                  _id: actionId,
                  systemPath: "actions",
                  baseAction: false,
                  description: "",
                  chatDisplay: true,
                  originItem: { type: "itemCollection" },
                  actionType: "action",
                  triggers: [],
                  areas: [],
                  cost: [],
                  uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
                  damage: {
                      parts: {
                          hitPoints: {
                              value: {
                                  custom: { enabled: true, formula: formula },
                                  multiplier: "flat",
                                  flatMultiplier: 1,
                                  dice: "d6",
                                  bonus: null
                              },
                              applyTo: "hitPoints",
                              type: damageType,
                              base: false,
                              resultBased: false,
                              valueAlt: {
                                  multiplier: "flat",
                                  flatMultiplier: 1,
                                  dice: "d6",
                                  bonus: null,
                                  custom: { enabled: false, formula: "" }
                              }
                          }
                      },
                      includeBase: false,
                      direct: isDirect
                  },
                  target: { type: "any", amount: null },
                  effects: [],
                  name: StatblockImporter._detectedActionName("damage", null, formula),
                  range: ""
              };
          }
      }

      return detectedActions;
  }

  /**
   * Parses feature format:
   * Line 1: Title - ActionType (optional)
   * Line 2+: Description
   *
   * ActionType can be: Action, Reaction, Passive
   * If not specified, defaults to Passive
   */
  static parseFeatureData(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) throw new Error(localize("Importer.emptyFeatureBlock"));

      const firstLine = lines[0];
      let name = firstLine;
      let featureForm = "passive"; // default
      let description = "";

      // Check for ActionType: "Name - Action", "Name - Reaction", "Name - Passive"
      const actionMatch = StatblockImporter._parseFeatureHeaderLine(firstLine);
      if (actionMatch) {
          name = actionMatch.name;
          featureForm = actionMatch.form.toLowerCase();
          description = actionMatch.description;
      }

      if (lines.length > 1) {
          description = [description, lines.slice(1).join(" ")].filter(Boolean).join(" ");
      }

      // Wrap dice rolls in [[/r ]] format
      description = StatblockImporter.wrapDiceRolls(description);

      const img = StatblockImporter._getDefaultImage("feature");

      // Detect actions in description
      const detectedActions = StatblockImporter.detectActionsInDescription(description);

      const result = {
          name,
          type: "feature",
          img,
          system: {
              featureForm: featureForm,
              description: description
          }
      };

      // Add detected actions if any were found
      if (Object.keys(detectedActions).length > 0) {
          result.system.actions = detectedActions;
      }

      return result;
  }

  /**
   * Parses simple item format (Loot/Consumable):
   * Line 1: Title
   * Line 2+: Description
   */
  static parseSimpleItemData(text, type) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) throw new Error(localize("Importer.emptyItemBlock"));

      const name = lines[0];
      let description = lines.length > 1 ? lines.slice(1).join(" ") : "";

      // Wrap dice rolls in [[/r ]] format
      description = StatblockImporter.wrapDiceRolls(description);

      const img = StatblockImporter._getDefaultImage(type);

      // Detect actions in description
      const detectedActions = StatblockImporter.detectActionsInDescription(description);

      // For consumables, use the template base and always add a "Spend Use" action
      if (type === "consumable") {
          const result = foundry.utils.deepClone(TEMPLATES.consumable);
          result.name = name;
          result.img = img;
          result.system.description = description;

          // Add detected actions
          if (Object.keys(detectedActions).length > 0) {
              result.system.actions = detectedActions;
          }

          // Always add a "Spend Use" action for consumables
          const spendUseId = foundry.utils.randomID(16);
          const spendUseAction = foundry.utils.deepClone(TEMPLATES.consumableActionSpendUse);
          spendUseAction._id = spendUseId;
          result.system.actions[spendUseId] = spendUseAction;

          return result;
      }

      const result = {
          name,
          type,
          img,
          system: {
              description: description
          }
      };

      // Add detected actions if any were found
      if (Object.keys(detectedActions).length > 0) {
          result.system.actions = detectedActions;
      }

      return result;
  }

  /**
   * Parses Domain Card format:
   * Line 1: TITLE
   * Line 2: Level X DOMAIN TYPE
   * Line 3: Recall Cost: Y
   * Line 4+: DESCRIPTION
   */
  static parseDomainCardData(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 3) throw new Error(localize("Importer.invalidDomainCardFormat"));

      const name = lines[0];
      const secondLine = lines[1];
      const thirdLine = lines[2];

      // Parse Line 2: Level X DOMAIN TYPE
      // Example: Level 1 Codex Spell
      // Using greedy match for domain to allow spaces if needed, but assuming type is last word
      const typeMatch = secondLine.match(/^Level\s+(\d+)\s+(.+?)\s+(Spell|Ability|Grimoire)$/i);
      if (!typeMatch) {
          throw new Error(localize("Importer.invalidDomainCardLine2"));
      }

      const level = parseInt(typeMatch[1], 10);
      const domainRaw = typeMatch[2].trim();
      const cardType = typeMatch[3].toLowerCase(); // spell, ability, grimoire

      // Resolve domain against native + homebrew choices to satisfy DHItem enum validation
      const domainMap = StatblockImporter._buildDomainMap();
      const domain = domainMap[domainRaw.toLowerCase()];

      if (!domain) {
          throw new Error(format("Importer.invalidDomainChoice", { domain: domainRaw }));
      }

      // Parse Line 3: Recall Cost: Y
      const costMatch = thirdLine.match(/^Recall\s*Cost:\s*(\d+)$/i);
      if (!costMatch) {
          throw new Error(localize("Importer.invalidDomainCardLine3"));
      }
      const recallCost = parseInt(costMatch[1], 10);

      // Description is rest
      let description = lines.length > 3 ? lines.slice(3).join(" ") : "";

      // Wrap dice rolls in [[/r ]] format
      description = StatblockImporter.wrapDiceRolls(description);

      const img = StatblockImporter._getDefaultImage("domainCard", cardType);

      // Detect actions in description
      const detectedActions = StatblockImporter.detectActionsInDescription(description);

      const result = {
          name,
          type: "domainCard",
          img,
          system: {
              description: description,
              domain: domain,
              recallCost: recallCost,
              level: level,
              type: cardType
          }
      };

      // Add detected actions if any were found
      if (Object.keys(detectedActions).length > 0) {
          result.system.actions = detectedActions;
      }

      return result;
  }


  /**
   * Parses Weapon format:
   * Line 1: Tier(opt) Name Trait Range Damage Burden Feature(opt)
   * Line 2+: Description
   */
  static parseWeaponData(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) throw new Error(localize("Importer.emptyWeaponBlock"));

      let firstLine = lines[0];
      const descriptionLines = lines.length > 1 ? lines.slice(1) : [];

      // 1. Extract Tier (optional)
      let tier = 1;
      const tierMatch = firstLine.match(/^Tier\s+(\d+)\s+/i);
      if (tierMatch) {
          tier = parseInt(tierMatch[1], 10);
          firstLine = firstLine.substring(tierMatch[0].length); // Remove Tier X from start
      }

      // 2. Main Regex for: Trait | Range | Damage | Burden
      // We look for this sequence. Everything before is Name. Everything after is Feature.
      const traitRegex = "(Agility|Finesse|Strength|Knowledge|Presence|Instinct)";
      const rangeRegex = "(Melee|Very Close|Close|Far|Very Far)";
      const burdenRegex = "(One-Handed|Two-Handed)";
      const damageRegex = "(\\d*d\\d+(?:[+-]\\d+)?\\s+\\S+)"; // e.g. "d8 phy" or "1d8+3 mag/phy"

      // Composite regex: Trait -space- Range -space- Damage -space- Burden
      const coreRegex = new RegExp(`${traitRegex}\\s+${rangeRegex}\\s+${damageRegex}\\s+${burdenRegex}`, "i");
      
      const match = firstLine.match(coreRegex);

      if (!match) {
          throw new Error(localize("Importer.invalidWeaponFormat"));
      }

      // Extract parts
      const traitRaw = match[1];
      const rangeRaw = match[2];
      const damageRaw = match[3];
      const burdenRaw = match[4];

      // Name is everything before the match
      const name = firstLine.substring(0, match.index).trim();
      
      // Feature is everything after the match
      const featureText = firstLine.substring(match.index + match[0].length).trim();

      // Combine Description + Feature (description first, feature last)
      let fullDescription = "";
      if (descriptionLines.length > 0) fullDescription += `<p>${descriptionLines.join(" ")}</p>`;
      if (featureText) fullDescription += `<p><strong>${featureText}</strong></p>`;

      // Wrap dice rolls in [[/r ]] format
      fullDescription = StatblockImporter.wrapDiceRolls(fullDescription);

      // --- MAPPINGS ---
      
      // Trait -> Lowercase
      const trait = traitRaw.toLowerCase();

      // Range -> CamelCase
      const rangeMap = {
          "melee": "melee",
          "very close": "veryClose",
          "close": "close",
          "far": "far",
          "very far": "veryFar"
      };
      const range = rangeMap[rangeRaw.toLowerCase()] || "melee";

      // Burden -> CamelCase
      const burden = burdenRaw.toLowerCase() === "one-handed" ? "oneHanded" : "twoHanded";

      // Damage Parsing
      const damageParts = [];
      const dmgParse = damageRaw.match(/^(\d*)d(\d+)([+-]\d+)?\s+(.+)$/);
      
      if (dmgParse) {
          const flatMultStr = dmgParse[1]; // Empty means 1
          const dieSize = `d${dmgParse[2]}`;
          const bonusStr = dmgParse[3]; // +X or -X
          const typeStr = dmgParse[4].toLowerCase(); // phy or phy/mag

          const flatMultiplier = flatMultStr ? parseInt(flatMultStr, 10) : 1;
          const bonus = bonusStr ? parseInt(bonusStr.replace(/\s/g, ""), 10) : null;

          // Parse Types
          const rawTypes = typeStr.split("/");
          const types = [];
          rawTypes.forEach(t => {
              if (t.includes("phy")) types.push("physical");
              if (t.includes("mag")) types.push("magical");
          });

          // Construct JSON Object
          const damagePart = {
              "type": types,
              "value": {
                  "multiplier": "prof", // Default per JSON example, though weapons usually just use flat stats? Sticking to prompt.
                  "dice": dieSize,
                  "flatMultiplier": flatMultiplier,
                  "bonus": bonus,
                  "custom": { "enabled": false, "formula": "" }
              },
              "applyTo": "hitPoints",
              "resultBased": false,
              "valueAlt": { // Default boilerplate
                  "multiplier": "prof",
                  "flatMultiplier": 1,
                  "dice": "d6",
                  "bonus": null,
                  "custom": { "enabled": false, "formula": "" }
              },
              "base": false
          };
          damageParts.push(damagePart);
      }

      // Detect actions in description
      const detectedActions = StatblockImporter.detectActionsInDescription(fullDescription);

      // For weapons, remove "Attack" and "Damage" actions (they are redundant with the weapon's base attack)
      for (const [id, action] of Object.entries(detectedActions)) {
          if (action.type === "attack" || action.type === "damage") {
              delete detectedActions[id];
          }
      }

      // --- RESULT ---
      // Clone do template base para garantir todos campos obrigatórios
      const result = foundry.utils.deepClone(TEMPLATES.weapon);

      // Override campos parseados
      result.name = name;
      result.img = StatblockImporter._getDefaultImage("weapon");
      result.system.tier = tier;
      result.system.burden = burden;
      result.system.description = fullDescription;

      // Attack overrides
      result.system.attack._id = foundry.utils.randomID();
      result.system.attack.range = range;
      result.system.attack.roll.trait = trait;

      // Damage overrides (se parsing foi bem sucedido)
      if (damageParts.length > 0) {
          const parsed = damageParts[0];
          const dmgPart = result.system.attack.damage.parts.hitPoints;
          dmgPart.type = parsed.type;
          dmgPart.value.dice = parsed.value.dice;
          dmgPart.value.flatMultiplier = parsed.value.flatMultiplier;
          dmgPart.value.bonus = parsed.value.bonus;
      }

      // Add detected actions if any were found
      if (Object.keys(detectedActions).length > 0) {
          result.system.actions = detectedActions;
      }

      // Store featureText for +Code generator (will be removed before Item.create)
      result._featureText = featureText;

      return result;
  }

  /**
   * Parses Armor items
   * Format: [Tier X] Name X / Y Z [FeatureName: FeatureDescription]
   * Examples:
   * Improved Gambeson Armor 7 / 16 4 Flexible: +1 to Evasion
   * Tier 2 Improved Chainmail Armor 11 / 24 5 Heavy: −1 to Evasion
   */
  static parseArmorData(text) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) throw new Error(localize("Importer.emptyArmorBlock"));

      let firstLine = lines[0];
      const descriptionLines = lines.length > 1 ? lines.slice(1) : [];

      // 1. Extract Tier (optional)
      let tier = 1;
      const tierMatch = firstLine.match(/^Tier\s+(\d+)\s+/i);
      if (tierMatch) {
          tier = parseInt(tierMatch[1], 10);
          firstLine = firstLine.substring(tierMatch[0].length);
      }

      // 2. Main Regex for: Thresholds (X / Y) and Base Score (Z)
      // Pattern: Name ... X / Y Z [Feature]
      const thresholdRegex = /(\d+)\s*\/\s*(\d+)\s+(\d+)(?:\s+(.*))?$/;
      const match = firstLine.match(thresholdRegex);

      if (!match) {
          throw new Error(localize("Importer.invalidArmorFormat"));
      }

      const major = parseInt(match[1], 10);
      const severe = parseInt(match[2], 10);
      const baseScore = parseInt(match[3], 10);
      const featureText = match[4]?.trim() || "";

      // Name is everything before the thresholds
      const name = firstLine.substring(0, match.index).trim();

      // Build description: Feature (if exists and not "—") + description lines
      let fullDescription = "";

      // Parse feature if it's not empty or just a dash
      if (featureText && featureText !== "—" && featureText !== "-") {
          fullDescription += `<p><strong>${featureText}</strong></p>`;
      }

      if (descriptionLines.length > 0) {
          fullDescription += `<p>${descriptionLines.join(" ")}</p>`;
      }

      // Wrap dice rolls in [[/r ]] format
      fullDescription = StatblockImporter.wrapDiceRolls(fullDescription);

      // Detect actions in description
      const detectedActions = StatblockImporter.detectActionsInDescription(fullDescription);

      // --- RESULT ---
      const result = {
          name,
          type: "armor",
          img: StatblockImporter._getDefaultImage("armor"),
          system: {
              tier: tier,
              armor: {
                  current: 0,
                  max: baseScore
              },
              baseThresholds: {
                  major: major,
                  severe: severe
              },
              description: fullDescription
          }
      };

      // Add detected actions if any were found
      if (Object.keys(detectedActions).length > 0) {
          result.system.actions = detectedActions;
      }

      // Store featureText for +Code generator (will be removed before Item.create)
      result._featureText = featureText;

      return result;
  }

  /**
   * Parses complex Actor Statblocks
   */
  static async parseStatblockData(text, forceActorType = null) {
      StatblockImporter.registerSettings();

      text = StatblockImporter._normalizeActorStatblockText(text);

      const rawLines = text.split(/\r?\n/)
                        .map(l => l.trim())
                        .filter(l => l.length > 0);

      if (rawLines.length === 0) throw new Error(localize("Importer.emptyText"));

      // --- FEATURE COMPENDIUM SETUP ---
      const selectedFeaturePacks = game.settings.get(MODULE_ID, "selectedCompendiums") || [`${MODULE_ID}.all-features`];
      const featureIndexMap = new Map();

      for (const packId of selectedFeaturePacks) {
          const pack = game.packs.get(packId);
          if (pack) {
              const index = await pack.getIndex({fields: ["name", "type"]});
              index.forEach(i => {
                  if (i.type === "feature") {
                      featureIndexMap.set(i.name.toLowerCase(), { uuid: i.uuid, pack: pack });
                  }
              });
          }
      }

      // --- ADVERSARY COMPENDIUM SETUP ---
      const selectedActorPacks = game.settings.get(MODULE_ID, "selectedActorCompendiums") || ["daggerheart.adversaries"];
      let adversaryIndex = [];

      for (const packId of selectedActorPacks) {
          const pack = game.packs.get(packId);
          if (pack) {
              const index = await pack.getIndex({fields: ["name", "type"]});
              index.forEach(i => adversaryIndex.push(i));
          }
      }

      // --- INITIAL SETUP ---
      const name = rawLines[0];
      let actorType = forceActorType || "adversary"; 

      const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRegex = new RegExp(escapeRegExp(name), 'gi');
      const replaceNameInText = (txt) => {
          return txt.replace(nameRegex, "@Lookup[@name]");
      };

      const systemData = {};
      const items = []; 
      const rangeMap = { "very close": "veryClose", "close": "close", "far": "far", "melee": "melee", "very far": "veryFar" };

      let featuresIndex = rawLines.findIndex(l => /^FEATURES:?$/i.test(l));
      
      let statBlockLines = featuresIndex !== -1 ? rawLines.slice(0, featuresIndex) : rawLines;
      let featureBlockLines = featuresIndex !== -1 ? rawLines.slice(featuresIndex + 1) : [];

      // --- MULTILINE PARSING ---
      let descriptionBuffer = [];
      let motivesBuffer = [];
      let impulsesBuffer = [];
      let potentialAdvBuffer = [];
      let captureState = "none"; 
      let statSegments = [];

      const isStatLine = (line) => {
          if (line.match(/Diffi\s*culty:/i)) return true;
          if (line.match(/HP:/i)) return true;
          if (line.match(/Thresholds:/i)) return true;
          if (line.match(/Stress:/i)) return true;
          if (line.match(/ATK:/i)) return true;
          if (line.match(/Experience:/i)) return true;
          if (line.includes("|")) return true; 
          return false;
      };

      for (let i = 0; i < statBlockLines.length; i++) {
          const line = statBlockLines[i];

          // Tier/Type
          const tierMatch = line.match(/^Tier\s+(\d+)\s+(.+)$/i);
          if (tierMatch) {
              systemData.tier = parseInt(tierMatch[1], 10);
              let rawType = tierMatch[2].trim();

              const hordeMatch = rawType.match(/Horde\s*\((\d+)\/HP\)/i);
              if (hordeMatch) {
                  systemData.type = "horde";
                  systemData.hordeHp = parseInt(hordeMatch[1], 10);
              } else {
                  systemData.type = rawType.toLowerCase();
              }

              if (actorType === "adversary" && !StatblockImporter.VALID_ADVERSARY_TYPES.includes(systemData.type)) {
                  throw new Error(format("Importer.invalidAdversaryType", { type: rawType, types: StatblockImporter.VALID_ADVERSARY_TYPES.join(", ") }));
              }

              if (actorType === "environment" && !StatblockImporter.VALID_ENVIRONMENT_TYPES.includes(systemData.type)) {
                  throw new Error(format("Importer.invalidEnvironmentType", { type: rawType, types: StatblockImporter.VALID_ENVIRONMENT_TYPES.join(", ") }));
              }

              captureState = "description";
              continue;
          }

          // Buffer Start Markers
          const motivesMatch = line.match(/^Motives\s*(?:&|and)\s*Tactics:\s*(.*)$/i);
          if (motivesMatch) {
              captureState = "motives";
              motivesBuffer.push(motivesMatch[1].trim());
              continue;
          }

          if (line.startsWith("Impulses:")) {
              captureState = "impulses";
              impulsesBuffer.push(line.replace("Impulses:", "").trim());
              continue;
          }

          if (line.startsWith("Potential Adversaries:")) {
              captureState = "potential";
              potentialAdvBuffer.push(line.replace("Potential Adversaries:", "").trim());
              continue;
          }

          // Stat Line
          if (isStatLine(line)) {
              const parts = line.split("|").map(p => p.trim()).filter(p => p.length > 0);
              statSegments.push(...parts);
              continue; 
          }

          // Free Text
          if (i > 0 && captureState !== "none") {
              if (captureState === "description") descriptionBuffer.push(line);
              else if (captureState === "motives") motivesBuffer.push(line);
              else if (captureState === "impulses") impulsesBuffer.push(line);
              else if (captureState === "potential") potentialAdvBuffer.push(line);
          }
      }

      // --- DATA STRUCTURING ---
      if (descriptionBuffer.length > 0) systemData.description = descriptionBuffer.join(" ");
      
      if (actorType === "environment") {
          if (impulsesBuffer.length > 0) systemData.impulses = impulsesBuffer.join(" ");
          
          if (potentialAdvBuffer.length > 0) {
              const advText = potentialAdvBuffer.join(" ");
              systemData.notes = advText;

              // Parse the potential adversaries text
              // Supports:
              // Pattern 1: Group1 (Actor1, Actor2), Group2 (Actor3, Actor4)
              // Pattern 2: Actor1, Actor2, Group1 (Actor3, Actor4)
              const groupedActors = {}; // { groupLabel: [actorNames] }
              let ungroupedActors = [];

              // First, extract all groups with parentheses: "GroupName (Actor1, Actor2)"
              const groupRegex = /([^,(]+?)\s*\(([^)]+)\)/g;
              let processedText = advText;
              let match;

              while ((match = groupRegex.exec(advText)) !== null) {
                  const groupLabel = match[1].trim();
                  const actorsList = match[2];
                  const actorNames = actorsList.split(",").map(a => a.trim()).filter(a => a.length > 0);

                  if (!groupedActors[groupLabel]) {
                      groupedActors[groupLabel] = [];
                  }
                  groupedActors[groupLabel].push(...actorNames);

                  // Remove this match from processedText to find ungrouped actors
                  processedText = processedText.replace(match[0], '');
              }

              // Parse remaining text for ungrouped actors (comma-separated)
              processedText = processedText.replace(/,\s*,/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
              if (processedText.length > 0) {
                  ungroupedActors = processedText.split(",").map(a => a.trim()).filter(a => a.length > 0);
              }

              // Look up actors in compendiums and build potentialAdversaries
              const potentialAdversaries = {};
              const previewDetails = []; // For preview: [{name, label, found}]
              let hasFoundActors = false;

              // Process grouped actors
              for (const [groupLabel, actorNames] of Object.entries(groupedActors)) {
                  const foundUuids = [];
                  for (const actorName of actorNames) {
                      const found = adversaryIndex.find(a => a.name.toLowerCase() === actorName.toLowerCase() && a.type === "adversary");
                      if (found) {
                          foundUuids.push(found.uuid);
                          previewDetails.push({ name: actorName, label: groupLabel, found: true });
                      } else {
                          previewDetails.push({ name: actorName, label: groupLabel, found: false });
                      }
                  }

                  if (foundUuids.length > 0) {
                      hasFoundActors = true;
                      const groupId = foundry.utils.randomID();
                      potentialAdversaries[groupId] = {
                          label: groupLabel,
                          adversaries: foundUuids
                      };
                  }
              }

              // Process ungrouped actors under "Adversaries" label
              if (ungroupedActors.length > 0) {
                  const foundUuids = [];
                  const adversariesLabel = localizeKey("DAGGERHEART.UI.ItemBrowser.folders.adversaries", actorTypeLabel("adversary"));
                  for (const actorName of ungroupedActors) {
                      const found = adversaryIndex.find(a => a.name.toLowerCase() === actorName.toLowerCase() && a.type === "adversary");
                      if (found) {
                          foundUuids.push(found.uuid);
                          previewDetails.push({ name: actorName, label: adversariesLabel, found: true });
                      } else {
                          previewDetails.push({ name: actorName, label: adversariesLabel, found: false });
                      }
                  }

                  if (foundUuids.length > 0) {
                      hasFoundActors = true;
                      const groupId = foundry.utils.randomID();
                      potentialAdversaries[groupId] = {
                          label: adversariesLabel,
                          adversaries: foundUuids
                      };
                  }
              }

              // Store preview details for display (not saved to actor)
              systemData._potentialAdvPreview = previewDetails;

              // Only add potentialAdversaries if any actors were found
              if (hasFoundActors) {
                  systemData.potentialAdversaries = potentialAdversaries;
              }
          }
      } else {
          if (motivesBuffer.length > 0) systemData.motivesAndTactics = motivesBuffer.join(" ");
          systemData.resources = { hitPoints: { value: 0 }, stress: { value: 0 } };
          // CHANGE: Added type: "attack" inside roll object
          //systemData.attack = { roll: { type: "attack" }, img: "icons/magic/death/skull-humanoid-white-blue.webp", damage: { parts: [], includeBase: false, direct: false } };
          systemData.attack = { chatDisplay: false, roll: { type: "attack" }, img: "icons/magic/death/skull-humanoid-white-blue.webp", damage: { parts: {}, includeBase: false, direct: false } };
          systemData.experiences = {};
      }

      // --- PROCESS SEGMENTS ---
      for (let segment of statSegments) {
          const difficultyMatch = segment.match(/Diffi\s*culty:\s*(\d+)/i);
          if (difficultyMatch) systemData.difficulty = parseInt(difficultyMatch[1], 10);

          if (actorType === "environment") continue;

          const thresholdsMatch = segment.match(/Thresholds:\s*(\d+)\s*\/\s*(\d+)/i);
          if (thresholdsMatch) {
              systemData.damageThresholds = { major: parseInt(thresholdsMatch[1], 10), severe: parseInt(thresholdsMatch[2], 10) };
          }

          const hpMatch = segment.match(/HP:\s*(\d+)/i);
          if (hpMatch) systemData.resources.hitPoints.max = parseInt(hpMatch[1], 10);

          const stressMatch = segment.match(/Stress:\s*(\d+)/i);
          if (stressMatch) systemData.resources.stress.max = parseInt(stressMatch[1], 10);

          const atkMatch = segment.match(/^ATK:\s*([+\-\u2013\u2014\u2212]?\s*\d+)/i);
          if (atkMatch) {
              let bonusClean = atkMatch[1].replace(/[\u2013\u2014\u2212]/g, "-").replace(/\s/g, "");
              systemData.attack.roll.bonus = bonusClean;
          }

          const rangeRegex = /^(.+):\s*(Very Close|Close|Far|Melee|Very Far)$/i;
          const nameRangeMatch = segment.match(rangeRegex);
          if (nameRangeMatch) {
              const pName = nameRangeMatch[1].trim();
              const pRange = nameRangeMatch[2].trim().toLowerCase();
              if (rangeMap[pRange] && !segment.includes("Diffi") && !segment.includes("Tier")) {
                  systemData.attack.name = pName;
                  systemData.attack.range = rangeMap[pRange];
              }
          }

          const damageDiceRegex = /^(\d*)d(\d+)(?:\s*([+\-]\s*\d+))?\s+(.+)$/i;
          const damageStaticRegex = /^(\d+)\s+(.+)$/i;
          let dmgMatch = segment.match(damageDiceRegex);
          let isStatic = false;

          if (!dmgMatch) { 
              dmgMatch = segment.match(damageStaticRegex); 
              isStatic = !!dmgMatch; 
          }

          if (dmgMatch) {
              const types = [];
              const rawTypeString = isStatic ? dmgMatch[2] : dmgMatch[4];
              const rawTypes = rawTypeString.split("/").map(t => t.trim().toLowerCase());
              if (rawTypes.includes("phy") || rawTypes.includes("physical")) types.push("physical");
              if (rawTypes.includes("mag") || rawTypes.includes("magical")) types.push("magical");

              const damagePart = {
                  value: { custom: { enabled: false, formula: "" }, flatMultiplier: 1, dice: "d6", bonus: null, multiplier: "flat" },
                  type: types, applyTo: "hitPoints"
              };

              if (isStatic) {
                  damagePart.value.custom.enabled = true;
                  damagePart.value.custom.formula = dmgMatch[1];
              } else {
                  damagePart.value.flatMultiplier = dmgMatch[1] ? parseInt(dmgMatch[1], 10) : 1;
                  damagePart.value.dice = `d${dmgMatch[2]}`;
                  if (dmgMatch[3]) {
                      const cleanBonus = dmgMatch[3].replace(/\s/g, "");
                      damagePart.value.bonus = parseInt(cleanBonus, 10);
                  }
              }
              if (types.length > 0) systemData.attack.damage.parts = { hitPoints: damagePart };
          }
          
           if (segment.startsWith("Experience:")) {
                const expContent = segment.substring("Experience:".length).trim();
                const expItems = expContent.split(",").map(e => e.trim());
    
                for (let item of expItems) {
                    const expMatch = item.match(/(.+?)\s+([+-]?\d+)$/);
                    if (expMatch) {
                        const expName = expMatch[1].trim();
                        const expValue = parseInt(expMatch[2], 10);
                        const id = foundry.utils.randomID();
                        systemData.experiences[id] = { name: expName, value: expValue, description: "" };
                    }
                }
            }
      }

      // --- FEATURE PARSING ---
      let currentFeature = null;

      const pushCurrentFeature = async () => {
          if (!currentFeature) return;

          const found = featureIndexMap.get(currentFeature.name.toLowerCase());
          if (found) {
              try {
                  const doc = await fromUuid(found.uuid);
                  if (doc) {
                      const itemData = doc.toObject();
                      foundry.utils.mergeObject(itemData, { flags: { dhImporter: { isCompendium: true } } });
                      items.push(itemData);
                      return;
                  }
              } catch (error) {
                  StatblockImporter.errorLog(format("Importer.failedCompendiumFeature", { name: currentFeature.name }), error, { uuid: found.uuid });
              }
          }
          
          let finalDesc = StatblockImporter._formatFeatureDescriptionHtml(currentFeature.system.description);

          // Wrap dice rolls in [[/r ]] format
          finalDesc = StatblockImporter.wrapDiceRolls(finalDesc);

          currentFeature.system.description = finalDesc;

          // Detect actions in description and add them to system.actions
          const detectedActions = StatblockImporter.detectActionsInDescription(finalDesc);

          // Add detected actions to feature if any were found
          if (Object.keys(detectedActions).length > 0) {
              currentFeature.system.actions = detectedActions;
          }

          items.push(currentFeature);
      };

      for (const line of featureBlockLines) {
          // Support both formats:
          // "Name - Type: Description" (with colon, description on same line)
          // "Name - Type" (without colon, description on following lines)
          const featureMatch = line.match(/^(.+?)\s*[-–—]\s*(Passive|Action|Reaction)(?::\s*(.*))?$/i);
          if (featureMatch) {
              if (currentFeature) {
                  await pushCurrentFeature();
                  currentFeature = null;
              }

              const featureName = featureMatch[1].trim();
              let featureDesc = (featureMatch[3] || "").trim();
              featureDesc = replaceNameInText(featureDesc);

              currentFeature = {
                  name: featureName,
                  type: "feature",
                  img: actorType === "environment"
                      ? (game.settings.get(MODULE_ID, "featureIconEnvironment") || "icons/environment/wilderness/cave-entrance.webp")
                      : (game.settings.get(MODULE_ID, "featureIconAdversary") || "icons/magic/symbols/star-solid-gold.webp"),
                  system: {
                      featureForm: featureMatch[2].toLowerCase(),
                      description: featureDesc ? `<p>${featureDesc}</p>` : ""
                  },
                  flags: { dhImporter: { isCompendium: false } }
              };
          } else {
              if (currentFeature) {
                  let cleanedLine = replaceNameInText(line);
                  let desc = currentFeature.system.description;

                  if (desc === "") {
                      // First line of description (when format is "Name - Type" without colon)
                      desc = `<p>${cleanedLine}</p>`;
                  } else {
                      desc = desc.replace("</p>", "");
                      if (line.trim().startsWith("•") || line.trim().startsWith("- ")) {
                          desc += `</p><p>${cleanedLine}</p>`;
                      } else {
                          desc += " " + cleanedLine + "</p>";
                      }
                  }
                  currentFeature.system.description = desc;
              }
          }
      }
      if (currentFeature) await pushCurrentFeature();

      if (actorType === "adversary" && systemData.type === "horde" && Object.keys(systemData.attack.damage.parts).length > 0) {
          const hordeFeature = items.find(i => /^Horde\s*\(.+\)$/i.test(i.name));
          if (hordeFeature) {
              const diceMatch = hordeFeature.name.match(/^Horde\s*\(\s*(\d+)d(\d+)([+-]\d+)?\s*\)$/i);
              if (diceMatch) {
                  const flatMultiplier = parseInt(diceMatch[1], 10);
                  const dice = `d${diceMatch[2]}`;
                  const bonus = diceMatch[3] ? parseInt(diceMatch[3], 10) : null;
                  systemData.attack.damage.parts.hitPoints.valueAlt = {
                      multiplier: "flat", flatMultiplier, dice, bonus, custom: { enabled: false, formula: "" }
                  };
              }
          }
      }

      return { name, systemData, items, actorType };
  }
}
