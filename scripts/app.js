import { StatblockConfig } from "./config.js";
import { TEMPLATES } from "./templates.js";
import { FeatureCodeDialog } from "./code-dialog.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main Importer Application using V13 ApplicationV2 standards.
 */
export class StatblockImporter extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Valid adversary types (lowercase) */
  static VALID_ADVERSARY_TYPES = ["bruiser", "horde", "leader", "minion", "ranged", "skulk", "social", "solo", "standard", "support"];

  /** Valid environment types (lowercase) */
  static VALID_ENVIRONMENT_TYPES = ["exploration", "social", "traversal", "event"];

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

  /** @override */
  static DEFAULT_OPTIONS = {
    id: "dh-statblock-importer",
    tag: "form",
    window: {
      title: "Daggerheart: Statblock Importer",
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
      template: "modules/dh-statblock-importer/templates/importer.hbs"
    }
  };

  /* -------------------------------------------- */
  /* Initialization Helper                       */
  /* -------------------------------------------- */

  static registerSettings() {
      // Feature Packs
      if (!game.settings.settings.has("dh-statblock-importer.selectedCompendiums")) {
          game.settings.register("dh-statblock-importer", "selectedCompendiums", {
              name: "Selected Feature Compendiums",
              scope: "client",
              config: false,
              type: Array,
              default: ["dh-statblock-importer.all-features"]
          });
      }

      // Actor Packs
      if (!game.settings.settings.has("dh-statblock-importer.selectedActorCompendiums")) {
          game.settings.register("dh-statblock-importer", "selectedActorCompendiums", {
              name: "Selected Actor Compendiums",
              scope: "client",
              config: false,
              type: Array,
              default: ["daggerheart.adversaries"]
          });
      }

      // Initialization Flag
      if (!game.settings.settings.has("dh-statblock-importer.configInitialized")) {
          game.settings.register("dh-statblock-importer", "configInitialized", {
              name: "Config Initialized",
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // Folder Names (Actors)
      if (!game.settings.settings.has("dh-statblock-importer.adversaryFolderName")) {
          game.settings.register("dh-statblock-importer", "adversaryFolderName", {
              name: "Adversary Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "💀 Imported Adversaries"
          });
      }

      if (!game.settings.settings.has("dh-statblock-importer.environmentFolderName")) {
          game.settings.register("dh-statblock-importer", "environmentFolderName", {
              name: "Environment Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "🏰 Imported Environments"
          });
      }

      // Folder Names (Items)
      if (!game.settings.settings.has("dh-statblock-importer.lootFolderName")) {
          game.settings.register("dh-statblock-importer", "lootFolderName", {
              name: "Loot Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "👑 Imported Loot"
          });
      }

      if (!game.settings.settings.has("dh-statblock-importer.consumableFolderName")) {
          game.settings.register("dh-statblock-importer", "consumableFolderName", {
              name: "Consumable Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "🧪 Imported Consumables"
          });
      }

      if (!game.settings.settings.has("dh-statblock-importer.weaponFolderName")) {
          game.settings.register("dh-statblock-importer", "weaponFolderName", {
              name: "Weapon Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "⚔️ Imported Weapons"
          });
      }

      if (!game.settings.settings.has("dh-statblock-importer.armorFolderName")) {
          game.settings.register("dh-statblock-importer", "armorFolderName", {
              name: "Armor Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "🛡️ Imported Armors"
          });
      }

      if (!game.settings.settings.has("dh-statblock-importer.featureFolderName")) {
          game.settings.register("dh-statblock-importer", "featureFolderName", {
              name: "Feature Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "✨ Imported Features"
          });
      }

      if (!game.settings.settings.has("dh-statblock-importer.domainCardFolderName")) {
          game.settings.register("dh-statblock-importer", "domainCardFolderName", {
              name: "Domain Card Folder Name",
              scope: "world",
              config: false,
              type: String,
              default: "📜 Imported Domain Cards"
          });
      }

      // Separator Mode (blankLine or separator)
      if (!game.settings.settings.has("dh-statblock-importer.separatorMode")) {
          game.settings.register("dh-statblock-importer", "separatorMode", {
              name: "Separator Mode",
              scope: "world",
              config: false,
              type: String,
              default: "blankLine"
          });
      }

      // Debug Mode
      if (!game.settings.settings.has("dh-statblock-importer.debugMode")) {
          game.settings.register("dh-statblock-importer", "debugMode", {
              name: "Debug Mode",
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // +Features Toggle State
      if (!game.settings.settings.has("dh-statblock-importer.plusFeaturesEnabled")) {
          game.settings.register("dh-statblock-importer", "plusFeaturesEnabled", {
              name: "+Features Enabled",
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }

      // +Code Generator Toggle State
      if (!game.settings.settings.has("dh-statblock-importer.codeGeneratorEnabled")) {
          game.settings.register("dh-statblock-importer", "codeGeneratorEnabled", {
              name: "+Code Generator Enabled",
              scope: "client",
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
      const debugMode = game.settings.get("dh-statblock-importer", "debugMode");
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
      const debugMode = game.settings.get("dh-statblock-importer", "debugMode");
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
      context.plusFeaturesEnabled = game.settings.get("dh-statblock-importer", "plusFeaturesEnabled");
      context.codeGeneratorEnabled = game.settings.get("dh-statblock-importer", "codeGeneratorEnabled");
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
                  plusFeaturesContainer.style.display = showPlusFeatures ? "flex" : "none";
              }

              // +Code visible for weapon/armor
              if (codeGeneratorContainer) {
                  const showCodeGenerator = (mode === "weapon" || mode === "armor");
                  codeGeneratorContainer.style.display = showCodeGenerator ? "flex" : "none";
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
                  ui.notifications.warn(`Instructions page for "${mode}" not found in Compendium.`);
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
          StatblockImporter.errorLog("Error opening instructions", err);
          ui.notifications.error("Failed to open instructions.");
      }
  }

  static async _onPlusFeatures(event, target) {
      const currentState = game.settings.get("dh-statblock-importer", "plusFeaturesEnabled");
      const newState = !currentState;
      await game.settings.set("dh-statblock-importer", "plusFeaturesEnabled", newState);

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
              ui.notifications.warn("+Features help page not found in Compendium.");
              console.warn("DH Importer | Could not find JournalEntryPage with UUID: Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.wvgvxX1ksmUL2Ahj");
          }
      } catch (err) {
          StatblockImporter.errorLog("Error opening +Features help", err);
          ui.notifications.error("Failed to open +Features help.");
      }
  }

  static async _onCodeGenerator(event, target) {
      const currentState = game.settings.get("dh-statblock-importer", "codeGeneratorEnabled");
      const newState = !currentState;
      await game.settings.set("dh-statblock-importer", "codeGeneratorEnabled", newState);

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
              ui.notifications.warn("+Code help page not found in Compendium.");
              console.warn("DH Importer | Could not find JournalEntryPage with UUID: Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp.JournalEntryPage.LiVwLebJ7Ih66gBw");
          }
      } catch (err) {
          StatblockImporter.errorLog("Error opening +Code help", err);
          ui.notifications.error("Failed to open +Code help.");
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
      if (mode === "feature") return "icons/magic/symbols/star-solid-gold.webp";
      
      if (mode === "domainCard") {
          if (subtype === "grimoire") return "icons/sundries/books/book-embossed-spiral-purple-white.webp";
          if (subtype === "ability") return "icons/magic/control/silhouette-hold-change-blue.webp";
          if (subtype === "spell") return "icons/sundries/documents/document-symbol-triangle-pink.webp";
          return "icons/sundries/scrolls/scroll-runed-blue.webp";
      }

      if (subtype === "environment") return "icons/environment/wilderness/cave-entrance.webp";
      return "modules/dh-statblock-importer/assets/images/skull.webp";
  }

  static async _onValidate(event, target) {
    const formElement = this.element;
    const textarea = formElement.querySelector("textarea[name='statblockText']");
    const modeSelect = formElement.querySelector("select[name='importMode']");
    const previewBox = formElement.querySelector("#dh-importer-preview");

    if (!textarea || !textarea.value.trim()) {
      previewBox.innerHTML = `<p style="color:red">Please paste text to validate.</p>`;
      return;
    }

    const text = textarea.value.trim();
    const mode = modeSelect?.value || "adversary";
    
    // Determine parsing strategy
    let blocks = [];
    let isItemMode = (mode === "loot" || mode === "consumable" || mode === "weapon" || mode === "armor" || mode === "feature" || mode === "domainCard");

    if (isItemMode) {
        blocks = StatblockImporter.splitSimpleItems(text);
    } else {
        blocks = StatblockImporter.splitStatblocks(text);
    }

    const isMultiple = blocks.length > 1;
    let fullHtml = "";

    if (isMultiple) {
      fullHtml += `<div class="dh-preview-item success" style="background:rgba(72,187,72,0.2);padding:8px;margin-bottom:10px;border-radius:4px;"><strong>Batch Mode:</strong> ${blocks.length} items detected</div>`;
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
        const firstLine = block.split(/\r?\n/)[0] || "Unknown";
        fullHtml += `<div class="dh-preview-item warning"><strong>#${blockIndex + 1} Error:</strong> ${error.message} (${firstLine})</div>`;
        continue;
      }

      // --- HTML Generation for Preview ---
      const defaultImg = result.img || StatblockImporter._getDefaultImage(mode, result.actorType);
      fullHtml += `<div class="dh-preview-entry">`;
      
      const labelPrefix = isMultiple ? `#${blockIndex + 1}: ` : "";
      
      fullHtml += `
          <div class="dh-preview-header">
              <img src="${defaultImg}" class="dh-preview-img" data-idx="${blockIndex}" title="Click to change image">
              <div class="dh-preview-name">${labelPrefix}${result.name}</div>
          </div>
      `;

      fullHtml += `<div class="dh-preview-body">`;
      
      const show = (label, value) => {
        if (value !== undefined && value !== null && value !== "") {
          return `<div class="dh-preview-item success"><strong>${label}:</strong> ${value}</div>`;
        }
        return `<div class="dh-preview-item warning"><strong>${label}:</strong> Not Found</div>`;
      };

      if (mode === "weapon") {
          // WEAPON PREVIEW
          fullHtml += show("Type", "Weapon");
          fullHtml += show("Tier", result.system.tier);
          fullHtml += show("Trait", result.system.attack.roll.trait);
          fullHtml += show("Range", result.system.attack.range);

          if (result.system.attack.damage.parts.length > 0) {
              const part = result.system.attack.damage.parts[0];
              const dmgStr = `${part.value.flatMultiplier > 1 ? part.value.flatMultiplier : ""}${part.value.dice}${part.value.bonus ? (part.value.bonus > 0 ? "+"+part.value.bonus : part.value.bonus) : ""} ${part.type.join("/")}`;
              fullHtml += show("Damage", dmgStr);
          }

          fullHtml += show("Burden", result.system.burden);

          // Show combined description (Feature + Desc)
          const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
          fullHtml += `<div class="dh-preview-item success"><strong>Full Description:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;

      } else if (mode === "armor") {
          // ARMOR PREVIEW
          fullHtml += show("Type", "Armor");
          fullHtml += show("Tier", result.system.tier);
          fullHtml += show("Base Score", result.system.baseScore);
          fullHtml += show("Thresholds", `${result.system.baseThresholds?.major || "?"}/${result.system.baseThresholds?.severe || "?"}`);

          if (result.system.description) {
              const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
              fullHtml += `<div class="dh-preview-item success"><strong>Description:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
          }

      } else if (mode === "feature") {
          // FEATURE PREVIEW
          fullHtml += show("Type", "Feature");
          const formLabel = result.system.featureForm ? (result.system.featureForm.charAt(0).toUpperCase() + result.system.featureForm.slice(1)) : "Passive";
          fullHtml += show("Action Type", formLabel);

          if (result.system.description) {
              const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
              fullHtml += `<div class="dh-preview-item success"><strong>Description:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
          }

      } else if (mode === "domainCard") {
          // DOMAIN CARD PREVIEW
          fullHtml += show("Type", "Domain Card");
          fullHtml += show("Domain", result.system.domain);
          fullHtml += show("Card Type", result.system.type);
          fullHtml += show("Level", result.system.level);
          fullHtml += show("Recall Cost", result.system.recallCost);

          if (result.system.description) {
              const descPreview = result.system.description.length > 100 ? result.system.description.substring(0, 100) + "..." : result.system.description;
              fullHtml += `<div class="dh-preview-item success"><strong>Description:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
          }
      
      } else if (isItemMode) {
          // SIMPLE ITEM PREVIEW
          fullHtml += show("Type", result.type);
          fullHtml += `<div class="dh-preview-item success"><strong>Description:</strong><br><em style="font-size:0.9em">${result.system.description}</em></div>`;
      } else {
          // ACTOR PREVIEW
          const data = result.systemData;
          const isEnvironment = result.actorType === "environment";

          fullHtml += show("Actor Type", isEnvironment ? "Environment" : "Adversary");
          fullHtml += show("Tier", data.tier);
          fullHtml += show("Type", data.type);
          if (data.type === "horde") fullHtml += show("Horde HP", data.hordeHp);
          fullHtml += show("Difficulty", data.difficulty);

          if (!isEnvironment) {
             // ADVERSARY SPECIFIC FIELDS
             fullHtml += show("HP", data.resources?.hitPoints?.max);
             fullHtml += show("Stress", data.resources?.stress?.max);

             // Damage Thresholds
             const threshStr = (data.damageThresholds?.major || data.damageThresholds?.severe)
                 ? `${data.damageThresholds.major || "?"}/${data.damageThresholds.severe || "?"}`
                 : null;
             fullHtml += show("Thresholds", threshStr);

             // Attack details - separate fields
             fullHtml += show("Attack", data.attack?.name);
             fullHtml += show("Range", data.attack?.range);
             fullHtml += show("ATK Bonus", data.attack?.roll?.bonus);

             // Damage - dice and type separate
             let dmgDice = null;
             let dmgType = null;
             let hordeDmg = null;
             if (data.attack?.damage?.parts?.length > 0) {
                 const part = data.attack.damage.parts[0];
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
             fullHtml += show("Damage", dmgDice);
             fullHtml += show("Damage Type", dmgType);
             if (data.type === "horde") fullHtml += show("Horde Damage", hordeDmg);

             // Experiences
             const expEntries = Object.values(data.experiences || {});
             const expStr = expEntries.length > 0
                 ? expEntries.map(e => `${e.name} ${e.value >= 0 ? "+"+e.value : e.value}`).join(", ")
                 : null;
             fullHtml += show("Experience", expStr);

             // Motives & Tactics
             const motivesPreview = data.motivesAndTactics
                 ? (data.motivesAndTactics.length > 80 ? data.motivesAndTactics.substring(0, 80) + "..." : data.motivesAndTactics)
                 : null;
             fullHtml += show("Motives", motivesPreview);
          } else {
             // ENVIRONMENT SPECIFIC FIELDS
             const impulsesPreview = data.impulses
                 ? (data.impulses.length > 80 ? data.impulses.substring(0, 80) + "..." : data.impulses)
                 : null;
             fullHtml += show("Impulses", impulsesPreview);

             // Potential Adversaries - show each actor with (Compendium) or (New), same style as features
             const potAdvPreview = data._potentialAdvPreview || [];
             if (potAdvPreview.length > 0) {
                 // Group by label for display
                 const byLabel = {};
                 for (const item of potAdvPreview) {
                     if (!byLabel[item.label]) byLabel[item.label] = [];
                     byLabel[item.label].push(item);
                 }
                 fullHtml += `<div class="dh-preview-item success"><strong>Potential Adversaries (${potAdvPreview.length}):</strong></div>`;
                 for (const [label, actors] of Object.entries(byLabel)) {
                     fullHtml += `<div class="dh-preview-subitem" style="font-weight:bold; margin-top:4px;">— ${label}:</div>`;
                     for (const actor of actors) {
                         const sourceTag = actor.found
                             ? '<span style="color:#48bb48">(Compendium)</span>'
                             : '<span style="color:#ffaa00">(New)</span>';
                         fullHtml += `<div class="dh-preview-subitem">• ${actor.name} ${sourceTag}</div>`;
                     }
                 }
             } else if (data.notes) {
                 fullHtml += show("Potential Adversaries", data.notes);
             }
          }

          // Description (both types)
          const descPreview = data.description
              ? (data.description.length > 100 ? data.description.substring(0, 100) + "..." : data.description)
              : null;
          fullHtml += show("Description", descPreview);

          // Features - one per line with source indicator
          if (result.items?.length > 0) {
              fullHtml += `<div class="dh-preview-item success"><strong>Features (${result.items.length}):</strong></div>`;
              for (const item of result.items) {
                  const isCompendium = item.flags?.dhImporter?.isCompendium === true;
                  const sourceTag = isCompendium ? '<span style="color:#48bb48">(Compendium)</span>' : '<span style="color:#ffaa00">(New)</span>';
                  fullHtml += `<div class="dh-preview-subitem">• ${item.name} ${sourceTag}</div>`;
              }
          } else {
              fullHtml += show("Features", null);
          }
      }

      fullHtml += `</div></div>`; 
    }

    previewBox.innerHTML = fullHtml;

    const images = previewBox.querySelectorAll(".dh-preview-img");
    images.forEach(img => {
        img.addEventListener("click", ev => {
            const fp = new foundry.applications.apps.FilePicker({
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
      ui.notifications.warn("Please paste some text first.");
      return;
    }

    const text = textarea.value.trim();
    const mode = modeSelect?.value || "adversary";
    const isItemMode = (mode === "loot" || mode === "consumable" || mode === "weapon" || mode === "armor" || mode === "feature" || mode === "domainCard");

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
            const rootName = "📦 Imported Items";
            const rootColor = "#052e00";
            
            let rootFolder = game.folders.find(f => f.name === rootName && f.type === "Item");
            if (!rootFolder) {
                rootFolder = await Folder.create({ name: rootName, type: "Item", color: rootColor });
            }

            // 2. Determine Subfolder Settings based on Mode
            let settingKey = "";
            let defaultName = "";
            let color = "#333333";

            if (mode === "loot") {
                settingKey = "lootFolderName";
                defaultName = "👑 Imported Loot";
                color = "#5c4600";
            } else if (mode === "consumable") {
                settingKey = "consumableFolderName";
                defaultName = "🧪 Imported Consumables";
                color = "#750027";
            } else if (mode === "weapon") {
                settingKey = "weaponFolderName";
                defaultName = "⚔️ Imported Weapons";
                color = "#002b3d"; // Deep Blue/Teal
            } else if (mode === "armor") {
                settingKey = "armorFolderName";
                defaultName = "🛡️ Imported Armors";
                color = "#3d2b00"; // Bronze/Brown
            } else if (mode === "feature") {
                settingKey = "featureFolderName";
                defaultName = "✨ Imported Features";
                color = "#4a3d00"; // Gold/Yellow
            } else if (mode === "domainCard") {
                settingKey = "domainCardFolderName";
                defaultName = "📜 Imported Domain Cards";
                color = "#1e0047"; // Indigo/Purple
            }

            const subFolderName = game.settings.get("dh-statblock-importer", settingKey) || defaultName;
            
            // 3. Find or Create Subfolder (Parent = Root)
            targetFolder = game.folders.find(f => f.name === subFolderName && f.type === "Item" && f.folder?.id === rootFolder.id);
            if (!targetFolder) {
                targetFolder = await Folder.create({ 
                    name: subFolderName, 
                    type: "Item", 
                    color: color,
                    folder: rootFolder.id // Set parent
                });
            }

        } else {
            // Actor Folder Logic (Existing)
            const advName = game.settings.get("dh-statblock-importer", "adversaryFolderName");
            const envName = game.settings.get("dh-statblock-importer", "environmentFolderName");
            
            if (mode === "environment") {
                 let f = game.folders.find(f => f.name === envName && f.type === "Actor");
                 if (!f) f = await Folder.create({ name: envName, type: "Actor", color: "#2a3d00" });
                 targetFolder = f;
            } else {
                 let f = game.folders.find(f => f.name === advName && f.type === "Actor");
                 if (!f) f = await Folder.create({ name: advName, type: "Actor", color: "#430047" });
                 targetFolder = f;
            }
        }
    } catch (error) {
        StatblockImporter.errorLog("Failed to create/find folders", error);
        return;
    }

    const progressNotification = (blocks.length > 1)
        ? ui.notifications.info(`Importing... (0/${totalBlocks})`, { progress: true })
        : null;

    // Accumulate features for batch creation (performance optimization)
    const pendingFeatures = [];

    // Accumulate features for +Code generator
    const collectedCodeFeatures = [];
    const codeGeneratorEnabled = game.settings.get("dh-statblock-importer", "codeGeneratorEnabled");

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (progressNotification) {
            progressNotification.update({ pct: (i + 1) / totalBlocks, message: `Importing... (${i + 1}/${totalBlocks})` });
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
                    : "modules/dh-statblock-importer/assets/images/skull.webp";

                // Remove preview-only properties before creating actor
                const cleanSystemData = { ...result.systemData };
                delete cleanSystemData._potentialAdvPreview;

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
                const plusFeaturesEnabled = game.settings.get("dh-statblock-importer", "plusFeaturesEnabled");
                if (plusFeaturesEnabled && result.items?.length > 0) {
                    const isEnvironment = result.actorType === "environment";
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
                            colorMap
                        });
                    }
                }
            }

        } catch (error) {
            const firstLine = block.split(/\r?\n/)[0] || "Unknown";
            failedBlocks.push({ index: i + 1, name: firstLine, error: error.message });
            StatblockImporter.errorLog(`Failed to import block ${i + 1}`, error);
        }
    }

    // Batch create all accumulated features
    if (pendingFeatures.length > 0) {
        if (progressNotification) {
            progressNotification.update({ pct: 0.95, message: `Creating ${pendingFeatures.length} features...` });
        }

        try {
            // Cache folders to avoid repeated lookups
            const folderCache = new Map();

            // Prepare all feature data with folder IDs
            const featureDataArray = [];
            for (const pending of pendingFeatures) {
                const { featureItem, isEnvironment, actorType, featureType, colorMap } = pending;

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
                    img: featureItem.img,
                    folder: featureFolder?.id
                });
            }

            // Batch create all features at once
            const createdFeatures = await Item.createDocuments(featureDataArray);
            StatblockImporter.debugLog(`+Features: Batch created ${createdFeatures.length} features`);
        } catch (batchError) {
            StatblockImporter.errorLog(`+Features: Batch creation failed`, batchError);
            ui.notifications.error(`Failed to create features in batch. Check console.`);
        }
    }

    if (progressNotification) progressNotification.update({ pct: 1, message: "Import complete!" });

    if (createdObjects.length > 0) {
        if (blocks.length > 1) ui.notifications.info(`Imported ${createdObjects.length} objects.`);
        if (createdObjects.length === 1 && !blocks.length > 1) createdObjects[0].sheet.render(true);
    }

    // +Code: Show feature code dialog if features were collected
    if (collectedCodeFeatures.length > 0 && codeGeneratorEnabled) {
        new FeatureCodeDialog({ features: collectedCodeFeatures }).render(true);
    }

    if (failedBlocks.length > 0) {
        ui.notifications.warn(`Failed to import ${failedBlocks.length} items. Check console.`);
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
      if (!type) type = "Unknown";
      
      const typeKey = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
      const color = colorMap[typeKey] || colorMap["Unknown"] || "#333333";

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

      const tierName = `Tier ${tier}`;
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
      const rootName = "📦 Imported Items";
      const rootColor = "#052e00";

      let rootFolder = game.folders.find(f => f.name === rootName && f.type === "Item");
      if (!rootFolder) {
          rootFolder = await Folder.create({ name: rootName, type: "Item", color: rootColor });
      }

      // 2. Find or Create Category Folder (Adversary Features or Environment Features)
      const categoryName = isEnvironment ? "✨ Environment Features" : "✨ Adversary Features";
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
      const typeKey = actorType.charAt(0).toUpperCase() + actorType.slice(1).toLowerCase();
      const typeColor = colorMap[typeKey] || colorMap["Unknown"] || "#333333";

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
      const featureTypeKey = featureType.charAt(0).toUpperCase() + featureType.slice(1).toLowerCase();

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
    const separatorMode = game.settings.get("dh-statblock-importer", "separatorMode") || "blankLine";

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

  /**
   * Detects and splits multiple Items based on separator mode.
   */
  static splitSimpleItems(text) {
      const separatorMode = game.settings.get("dh-statblock-importer", "separatorMode") || "blankLine";

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

      // Detect "Mark Stress" / "Mark a Stress" / "Mark 1 Stress" / "Mark 2 Stress"
      const stressMatch = description.match(/mark\s+(a\s+|(\d+)\s+)?stress/i);
      if (stressMatch) {
          const stressValue = stressMatch[2] ? parseInt(stressMatch[2], 10) : 1;
          const stressName = stressValue === 1 ? "Mark Stress" : `Mark ${stressValue} Stress`;
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

      // Detect "Spend Fear" / "Spend a Fear" / "Spend 1 Fear" / "Spend 2 Fear"
      const fearMatch = description.match(/spend\s+(a\s+|(\d+)\s+)?fear/i);
      if (fearMatch) {
          const fearValue = fearMatch[2] ? parseInt(fearMatch[2], 10) : 1;
          const fearName = fearValue === 1 ? "Spend Fear" : `Spend ${fearValue} Fear`;
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

      // Detect "Spend Hope" / "Spend a Hope" / "Spend 1 Hope" / "Spend 2 Hope"
      const hopeMatch = description.match(/spend\s+(a\s+|(\d+)\s+)?hope/i);
      if (hopeMatch) {
          const hopeValue = hopeMatch[2] ? parseInt(hopeMatch[2], 10) : 1;
          const hopeName = hopeValue === 1 ? "Spend a Hope" : `Spend ${hopeValue} Hope`;
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

      // Detect "TRAIT Reaction Roll" patterns (e.g., "Strength Reaction Roll", "Agility Reaction Roll")
      const traits = ["Strength", "Instinct", "Knowledge", "Finesse", "Presence", "Agility"];
      for (const trait of traits) {
          const reactionRollRegex = new RegExp(`${trait}\\s+Reaction\\s+Roll`, "i");
          if (reactionRollRegex.test(description)) {
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
                  cost: [],
                  uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
                  damage: {
                      parts: [],
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
      if (/make\s+(an?\s+)?(standard\s+)?attack(\s+roll)?/i.test(description)) {
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
              cost: [],
              uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
              damage: {
                  parts: [],
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
              name: "Attack",
              range: ""
          };
      }

      // Detect damage dice patterns only when in damage context
      // Check if text mentions "damage" at all (with or without type specifier)
      const hasDamageContext = /\bdamage\b/i.test(description);

      if (hasDamageContext) {
          // Detect damage type and direct flag
          // Default: physical, direct: false
          let damageType = ["physical"];
          let isDirect = false;

          if (/direct\s+(?:magic|magical)\s+damage/i.test(description)) {
              damageType = ["magical"];
              isDirect = true;
          } else if (/direct\s+physical\s+damage/i.test(description)) {
              damageType = ["physical"];
              isDirect = true;
          } else if (/direct\s+damage/i.test(description)) {
              // "direct damage" without type = physical + direct
              damageType = ["physical"];
              isDirect = true;
          } else if (/(?:magic|magical)\s+damage/i.test(description)) {
              damageType = ["magical"];
          } else if (/physical\s+damage/i.test(description)) {
              damageType = ["physical"];
          }
          // If just "damage" without type, defaults remain: physical, direct: false

          // Pattern: XdY or XdY+Z with optional spaces, with or without [[/r ]] wrapper
          const diceRegex = /(?:\[\[\/r\s+)?(\d+d\d+)(?:\s*([+-])\s*(\d+))?(?:\]\])?/g;
          const diceMatches = description.matchAll(diceRegex);

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
                  cost: [],
                  uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
                  damage: {
                      parts: [{
                          value: {
                              custom: { enabled: true, formula: formula },
                              multiplier: "prof",
                              flatMultiplier: 1,
                              dice: "d6",
                              bonus: null
                          },
                          applyTo: "hitPoints",
                          type: damageType,
                          base: false,
                          resultBased: false,
                          valueAlt: {
                              multiplier: "prof",
                              flatMultiplier: 1,
                              dice: "d6",
                              bonus: null,
                              custom: { enabled: false, formula: "" }
                          }
                      }],
                      includeBase: false,
                      direct: isDirect
                  },
                  target: { type: "any", amount: null },
                  effects: [],
                  name: `Damage (${formula})`,
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
      if (lines.length === 0) throw new Error("Empty feature block");

      const firstLine = lines[0];
      let name = firstLine;
      let featureForm = "passive"; // default

      // Check for ActionType: "Name - Action", "Name - Reaction", "Name - Passive"
      const actionMatch = firstLine.match(/^(.+?)\s*[-–—]\s*(Action|Reaction|Passive)$/i);
      if (actionMatch) {
          name = actionMatch[1].trim();
          featureForm = actionMatch[2].toLowerCase();
      }

      let description = lines.length > 1 ? lines.slice(1).join(" ") : "";

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
      if (lines.length === 0) throw new Error("Empty item block");

      const name = lines[0];
      let description = lines.length > 1 ? lines.slice(1).join(" ") : "";

      // Wrap dice rolls in [[/r ]] format
      description = StatblockImporter.wrapDiceRolls(description);

      const img = StatblockImporter._getDefaultImage(type);

      // Detect actions in description
      const detectedActions = StatblockImporter.detectActionsInDescription(description);

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
      if (lines.length < 3) throw new Error("Invalid Domain Card format. Needs Title, Level/Domain/Type, and Cost.");

      const name = lines[0];
      const secondLine = lines[1];
      const thirdLine = lines[2];

      // Parse Line 2: Level X DOMAIN TYPE
      // Example: Level 1 Codex Spell
      // Using greedy match for domain to allow spaces if needed, but assuming type is last word
      const typeMatch = secondLine.match(/^Level\s+(\d+)\s+(.+?)\s+(Spell|Ability|Grimoire)$/i);
      if (!typeMatch) {
          throw new Error("Invalid Line 2 format. Expected: 'Level X DOMAIN TYPE'");
      }

      const level = parseInt(typeMatch[1], 10);
      const domain = typeMatch[2].trim(); // Keeping as string as Daggerheart domains are usually strings (e.g. Bone, Codex)
      const cardType = typeMatch[3].toLowerCase(); // spell, ability, grimoire

      // Parse Line 3: Recall Cost: Y
      const costMatch = thirdLine.match(/^Recall\s*Cost:\s*(\d+)$/i);
      if (!costMatch) {
          throw new Error("Invalid Line 3 format. Expected: 'Recall Cost: Y'");
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
      if (lines.length === 0) throw new Error("Empty weapon block");

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
          throw new Error("Invalid weapon format. Could not find sequence: Trait Range Damage Burden");
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
          if (action.name === "Attack" || action.name?.startsWith("Damage")) {
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
          const dmgPart = result.system.attack.damage.parts[0];
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
      if (lines.length === 0) throw new Error("Empty armor block");

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
          throw new Error("Invalid armor format. Could not find: Thresholds (X/Y) and Base Score");
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
              baseScore: baseScore,
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

      const rawLines = text.split(/\r?\n/)
                        .map(l => l.trim())
                        .filter(l => l.length > 0);

      if (rawLines.length === 0) throw new Error("Text content is empty.");

      // --- FEATURE COMPENDIUM SETUP ---
      const selectedFeaturePacks = game.settings.get("dh-statblock-importer", "selectedCompendiums") || ["dh-statblock-importer.all-features"];
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
      const selectedActorPacks = game.settings.get("dh-statblock-importer", "selectedActorCompendiums") || ["daggerheart.adversaries"];
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
                  throw new Error(`Invalid adversary type: "${rawType}". Valid types are: ${StatblockImporter.VALID_ADVERSARY_TYPES.join(", ")}`);
              }

              if (actorType === "environment" && !StatblockImporter.VALID_ENVIRONMENT_TYPES.includes(systemData.type)) {
                  throw new Error(`Invalid environment type: "${rawType}". Valid types are: ${StatblockImporter.VALID_ENVIRONMENT_TYPES.join(", ")}`);
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
                  for (const actorName of ungroupedActors) {
                      const found = adversaryIndex.find(a => a.name.toLowerCase() === actorName.toLowerCase() && a.type === "adversary");
                      if (found) {
                          foundUuids.push(found.uuid);
                          previewDetails.push({ name: actorName, label: "Adversaries", found: true });
                      } else {
                          previewDetails.push({ name: actorName, label: "Adversaries", found: false });
                      }
                  }

                  if (foundUuids.length > 0) {
                      hasFoundActors = true;
                      const groupId = foundry.utils.randomID();
                      potentialAdversaries[groupId] = {
                          label: "Adversaries",
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
          systemData.attack = { roll: { type: "attack" }, img: "icons/magic/death/skull-humanoid-white-blue.webp", damage: { parts: [], includeBase: false, direct: false } };
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
              if (types.length > 0) systemData.attack.damage.parts = [damagePart];
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
                  StatblockImporter.errorLog(`Failed to load compendium feature: ${currentFeature.name}`, error, { uuid: found.uuid });
              }
          }
          
          let finalDesc = currentFeature.system.description;
          if (finalDesc.includes("•") || finalDesc.includes("- ")) {
              const lines = finalDesc.split("</p>").map(l => l.replace("<p>", "").trim()).filter(l => l);
              let listBuffer = [];
              let htmlParts = [];
              for (let l of lines) {
                  if (l.startsWith("•") || l.startsWith("- ")) {
                      listBuffer.push(`<li>${l.substring(1).trim()}</li>`);
                  } else {
                      if (listBuffer.length > 0) {
                          htmlParts.push(`<ul>${listBuffer.join("")}</ul>`);
                          listBuffer = [];
                      }
                      htmlParts.push(`<p>${l}</p>`);
                  }
              }
              if (listBuffer.length > 0) htmlParts.push(`<ul>${listBuffer.join("")}</ul>`);
              finalDesc = htmlParts.join("");
          }

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
                  img: actorType === "environment" ? "icons/environment/wilderness/cave-entrance.webp" : "icons/magic/symbols/star-solid-gold.webp",
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

      if (actorType === "adversary" && systemData.type === "horde" && systemData.attack.damage.parts.length > 0) {
          const hordeFeature = items.find(i => /^Horde\s*\(.+\)$/i.test(i.name));
          if (hordeFeature) {
              const diceMatch = hordeFeature.name.match(/^Horde\s*\(\s*(\d+)d(\d+)([+-]\d+)?\s*\)$/i);
              if (diceMatch) {
                  const flatMultiplier = parseInt(diceMatch[1], 10);
                  const dice = `d${diceMatch[2]}`;
                  const bonus = diceMatch[3] ? parseInt(diceMatch[3], 10) : 0;
                  systemData.attack.damage.parts[0].valueAlt = {
                      multiplier: "flat", flatMultiplier, dice, bonus, custom: { enabled: false, formula: "" }
                  };
              }
          }
      }

      return { name, systemData, items, actorType };
  }
}