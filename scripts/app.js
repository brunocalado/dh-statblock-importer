import { StatblockConfig } from "./config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main Importer Application using V13 ApplicationV2 standards.
 */
export class StatblockImporter extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Valid adversary types (lowercase) */
  static VALID_ADVERSARY_TYPES = ["bruiser", "horde", "leader", "minion", "ranged", "skulk", "social", "solo", "standard", "support"];

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
      instructions: StatblockImporter._onInstructions
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
  /* Action Handlers                             */
  /* -------------------------------------------- */

  static _onConfig(event, target) {
      new StatblockConfig().render(true);
  }

  static async _onInstructions(event, target) {
      try {
          const doc = await fromUuid("Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp");
          if (doc) {
              doc.sheet.render(true);
          } else {
              ui.notifications.warn("Instructions Journal Entry not found in Compendium.");
              console.warn("DH Importer | Could not find JournalEntry with UUID: Compendium.dh-statblock-importer.journal.JournalEntry.skE6HClujYrdKfKp");
          }
      } catch (err) {
          StatblockImporter.errorLog("Error opening instructions", err);
          ui.notifications.error("Failed to open instructions.");
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

             // Potential Adversaries
             const potAdvEntries = Object.values(data.potentialAdversaries || {});
             const potAdvStr = potAdvEntries.length > 0
                 ? potAdvEntries.map(p => `${p.name} (${p.quantity})`).join(", ")
                 : null;
             fullHtml += show("Potential Adversaries", potAdvStr);
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

                const actorData = {
                    name: result.name,
                    type: result.actorType,
                    system: result.systemData,
                    items: result.items,
                    folder: actorFolder?.id,
                    img: finalImg || defaultActorImg
                };
                
                const newActor = await Actor.create(actorData);
                if (newActor) createdObjects.push(newActor);
            }

        } catch (error) {
            const firstLine = block.split(/\r?\n/)[0] || "Unknown";
            failedBlocks.push({ index: i + 1, name: firstLine, error: error.message });
            StatblockImporter.errorLog(`Failed to import block ${i + 1}`, error);
        }
    }

    if (progressNotification) progressNotification.update({ pct: 1, message: "Import complete!" });

    if (createdObjects.length > 0) {
        if (blocks.length > 1) ui.notifications.info(`Imported ${createdObjects.length} objects.`);
        if (createdObjects.length === 1 && !blocks.length > 1) createdObjects[0].sheet.render(true);
    }

    if (failedBlocks.length > 0) {
        ui.notifications.warn(`Failed to import ${failedBlocks.length} items. Check console.`);
    }
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

      const description = lines.length > 1 ? lines.slice(1).join(" ") : "";

      const img = StatblockImporter._getDefaultImage("feature");

      return {
          name,
          type: "feature",
          img,
          system: {
              featureForm: featureForm,
              description: description
          }
      };
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
      const description = lines.length > 1 ? lines.slice(1).join(" ") : "";
      
      const img = StatblockImporter._getDefaultImage(type);

      return {
          name,
          type,
          img,
          system: {
              description: description
          }
      };
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
      const description = lines.length > 3 ? lines.slice(3).join(" ") : "";

      const img = StatblockImporter._getDefaultImage("domainCard", cardType);

      return {
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

      // Combine Feature + Description
      let fullDescription = "";
      if (featureText) fullDescription += `<p><strong>${featureText}</strong></p>`;
      if (descriptionLines.length > 0) fullDescription += `<p>${descriptionLines.join(" ")}</p>`;

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

      // --- RESULT ---
      return {
          name,
          type: "weapon",
          img: StatblockImporter._getDefaultImage("weapon"),
          system: {
              tier: tier,
              burden: burden,
              description: fullDescription,
              attack: {
                  range: range,
                  roll: { trait: trait },
                  damage: {
                      parts: damageParts,
                      includeBase: false,
                      direct: false
                  }
              }
          }
      };
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

      // --- RESULT ---
      return {
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
              systemData.potentialAdversaries = {};
              
              const groupRegex = /([^(,]+)\s*\(([^)]+)\)/g;
              let match;
              while ((match = groupRegex.exec(advText)) !== null) {
                  const groupLabel = match[1].trim();
                  const actorsList = match[2];
                  const actorNames = actorsList.split(",").map(a => a.trim());
                  const foundUuids = [];

                  for (const actorName of actorNames) {
                      const found = adversaryIndex.find(a => a.name.toLowerCase() === actorName.toLowerCase() && a.type === "adversary");
                      if (found) foundUuids.push(found.uuid);
                  }

                  const groupId = foundry.utils.randomID();
                  systemData.potentialAdversaries[groupId] = {
                      label: groupLabel,
                      adversaries: foundUuids
                  };
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

          // Wrap dice rolls in [[/r ]] format (e.g., 1d6, 2d8+3, 1d4-1)
          finalDesc = finalDesc.replace(/\b(\d+d\d+(?:[+-]\d+)?)\b/g, '[[/r $1]]');

          currentFeature.system.description = finalDesc;

          // Detect actions in description and add them to system.actions
          const detectedActions = {};

          // Detect "Mark Stress" / "Mark a Stress" / "Mark 1 Stress"
          if (/mark\s+(a\s+|1\s+)?stress/i.test(finalDesc)) {
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
                      value: 1,
                      itemId: null,
                      step: null,
                      consumeOnSuccess: false
                  }],
                  uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
                  effects: [],
                  target: { type: "any", amount: null },
                  name: "Mark Stress",
                  range: ""
              };
          }

          // Detect "Spend Fear" / "Spend a Fear" / "Spend 1 Fear"
          if (/spend\s+(a\s+|1\s+)?fear/i.test(finalDesc)) {
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
                      value: 1,
                      itemId: null,
                      step: null,
                      consumeOnSuccess: false
                  }],
                  uses: { value: null, max: "", recovery: null, consumeOnSuccess: false },
                  effects: [],
                  target: { type: "any", amount: null },
                  name: "Spend Fear",
                  range: ""
              };
          }

          // Detect "TRAIT Reaction Roll" patterns (e.g., "Strength Reaction Roll", "Agility Reaction Roll")
          const traits = ["Strength", "Instinct", "Knowledge", "Finesse", "Presence", "Agility"];
          for (const trait of traits) {
              const reactionRollRegex = new RegExp(`${trait}\\s+Reaction\\s+Roll`, "i");
              if (reactionRollRegex.test(finalDesc)) {
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
          if (/make\s+(a\s+)?(standard\s+)?attack(\s+roll)?/i.test(finalDesc)) {
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

          // Detect damage dice patterns (e.g., 1d10+3, 2d6 + 1, 1d12 - 2)
          // Extract from [[/r ...]] wrapped dice rolls
          const diceMatches = finalDesc.matchAll(/\[\[\/r\s+(\d+d\d+)(?:\s*([+-])\s*(\d+))?\]\]/g);
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
                          type: ["physical"],
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
                      direct: false
                  },
                  target: { type: "any", amount: null },
                  effects: [],
                  name: `Damage (${formula})`,
                  range: ""
              };
          }

          // Add detected actions to feature if any were found
          if (Object.keys(detectedActions).length > 0) {
              currentFeature.system.actions = detectedActions;
          }

          items.push(currentFeature);
      };

      for (const line of featureBlockLines) {
          const featureMatch = line.match(/^(.+?)\s*[-–—]\s*(Passive|Action|Reaction):\s*(.*)$/i);
          if (featureMatch) {
              if (currentFeature) {
                  await pushCurrentFeature();
                  currentFeature = null;
              }
              
              const featureName = featureMatch[1].trim();
              let featureDesc = featureMatch[3].trim();
              featureDesc = replaceNameInText(featureDesc);

              currentFeature = {
                  name: featureName,
                  type: "feature",
                  img: actorType === "environment" ? "icons/environment/wilderness/cave-entrance.webp" : "icons/magic/symbols/star-solid-gold.webp",
                  system: {
                      featureForm: featureMatch[2].toLowerCase(),
                      description: `<p>${featureDesc}</p>`
                  },
                  flags: { dhImporter: { isCompendium: false } }
              };
          } else {
              if (currentFeature) {
                  let cleanedLine = replaceNameInText(line);
                  let desc = currentFeature.system.description.replace("</p>", "");
                  if (line.trim().startsWith("•") || line.trim().startsWith("- ")) {
                      desc += `</p><p>${cleanedLine}</p>`;
                  } else {
                      desc += " " + cleanedLine + "</p>";
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