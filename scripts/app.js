import { StatblockConfig } from "./config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Main Importer Application using V13 ApplicationV2 standards.
 */
export class StatblockImporter extends HandlebarsApplicationMixin(ApplicationV2) {
  
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
      config: StatblockImporter._onConfig
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

      // Actor Packs (NOVO)
      if (!game.settings.settings.has("dh-statblock-importer.selectedActorCompendiums")) {
          game.settings.register("dh-statblock-importer", "selectedActorCompendiums", {
              name: "Selected Actor Compendiums",
              scope: "client",
              config: false,
              type: Array,
              default: ["daggerheart.adversaries"]
          });
      }

      // Flag de Inicialização
      if (!game.settings.settings.has("dh-statblock-importer.configInitialized")) {
          game.settings.register("dh-statblock-importer", "configInitialized", {
              name: "Config Initialized",
              scope: "client",
              config: false,
              type: Boolean,
              default: false
          });
      }
  }

  /* -------------------------------------------- */
  /* Action Handlers                             */
  /* -------------------------------------------- */

  static _onConfig(event, target) {
      new StatblockConfig().render(true);
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
    const forceActorType = modeSelect?.value || "adversary";
    const blocks = StatblockImporter.splitStatblocks(text);
    const isMultiple = blocks.length > 1;

    let fullHtml = "";

    if (isMultiple) {
      fullHtml += `<div class="dh-preview-item success" style="background:rgba(72,187,72,0.2);padding:8px;margin-bottom:10px;border-radius:4px;"><strong>Batch Mode:</strong> ${blocks.length} statblocks detected</div>`;
    }

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const result = await StatblockImporter.parseStatblockData(block, forceActorType);

      let html = "";
      const data = result.systemData;
      const items = result.items || [];
      const isEnvironment = result.actorType === "environment";

      if (isMultiple) {
        html += `<div style="border:1px solid var(--color-border-light-2);padding:8px;margin-bottom:10px;border-radius:4px;"><strong style="font-size:1.1em;">#${blockIndex + 1}: ${result.name}</strong><hr style="margin:5px 0;">`;
      }

      const show = (label, value) => {
        if (value !== undefined && value !== null && value !== "") {
          return `<div class="dh-preview-item success"><strong>${label}:</strong> ${value}</div>`;
        }
        return `<div class="dh-preview-item warning"><strong>${label}:</strong> Not Found</div>`;
      };

      html += show("Actor Type", isEnvironment ? "Environment" : "Adversary");
      html += show("Name", result.name);
      html += show("Tier", data.tier);
      html += show("Type", data.type);

      if (data.type === "horde") {
        html += show("Horde HP", data.hordeHp);
      }

      html += show("Difficulty", data.difficulty);

      // Campos exclusivos de Adversary
      if (!isEnvironment) {
        if (data.damageThresholds) {
          html += `<div class="dh-preview-item success"><strong>Thresholds:</strong> ${data.damageThresholds.major} / ${data.damageThresholds.severe}</div>`;
        } else {
          html += `<div class="dh-preview-item warning"><strong>Thresholds:</strong> Not Found</div>`;
        }

        if (data.resources?.hitPoints?.max) {
          html += `<div class="dh-preview-item success"><strong>HP:</strong> ${data.resources.hitPoints.max}</div>`;
        } else {
          html += `<div class="dh-preview-item warning"><strong>HP:</strong> Not Found</div>`;
        }

        if (data.resources?.stress?.max) {
          html += `<div class="dh-preview-item success"><strong>Stress:</strong> ${data.resources.stress.max}</div>`;
        } else {
          html += `<div class="dh-preview-item warning"><strong>Stress:</strong> Not Found</div>`;
        }

        // Attack Section
        html += show("Attack Name", data.attack?.name);
        html += show("Attack Range", data.attack?.range);
        html += show("Attack Bonus", data.attack?.roll?.bonus);

        // Attack Damage Preview
        if (data.attack?.damage?.parts?.length > 0) {
          const part = data.attack.damage.parts[0];
          let dmgString = "";

          if (part.value.custom?.enabled) {
            dmgString = `${part.value.custom.formula} (Static)`;
          } else {
            const bonusStr = part.value.bonus ? `+${part.value.bonus}` : "";
            dmgString = `${part.value.flatMultiplier}${part.value.dice}${bonusStr}`;
          }

          const types = part.type ? part.type.join(", ") : "None";
          let altString = "";

          if (part.valueAlt) {
            const altBonusStr = part.valueAlt.bonus ? `+${part.valueAlt.bonus}` : "";
            altString = ` <br><span style="color:var(--color-text-light-highlight)">[Horde: ${part.valueAlt.flatMultiplier}${part.valueAlt.dice}${altBonusStr}]</span>`;
          }

          html += `<div class="dh-preview-item success"><strong>Attack Damage:</strong> ${dmgString} [${types}]${altString}</div>`;
        } else {
          html += `<div class="dh-preview-item warning"><strong>Attack Damage:</strong> Not Found</div>`;
        }

        // Experiences
        if (data.experiences && Object.keys(data.experiences).length > 0) {
          let expList = '<ul class="dh-preview-sublist">';
          for (const [key, exp] of Object.entries(data.experiences)) {
            expList += `<li>${exp.name} (${exp.value >= 0 ? '+' : ''}${exp.value})</li>`;
          }
          expList += '</ul>';
          html += `<div class="dh-preview-item success"><strong>Experiences:</strong> Found ${Object.keys(data.experiences).length}${expList}</div>`;
        } else {
          html += `<div class="dh-preview-item warning"><strong>Experiences:</strong> Not Found</div>`;
        }
      }

      // Description
      if (data.description) {
        const descPreview = data.description.length > 100 ? data.description.substring(0, 100) + "..." : data.description;
        html += `<div class="dh-preview-item success"><strong>Description:</strong><br><em style="font-size:0.9em">${descPreview}</em></div>`;
      } else {
        html += `<div class="dh-preview-item warning"><strong>Description:</strong> Not Found</div>`;
      }

      // Motives or Impulses
      if (isEnvironment) {
        html += show("Impulses", data.impulses);

        // Preview de Potential Adversaries
        if (data.potentialAdversaries && Object.keys(data.potentialAdversaries).length > 0) {
          let advList = '<ul class="dh-preview-sublist">';
          for (const [key, group] of Object.entries(data.potentialAdversaries)) {
            const count = group.adversaries ? group.adversaries.length : 0;
            advList += `<li><strong>${group.label}</strong>: ${count} linked</li>`;
          }
          advList += '</ul>';
          html += `<div class="dh-preview-item success"><strong>Potential Adversaries:</strong> Found groups${advList}</div>`;
        } else if (data.notes) {
          html += `<div class="dh-preview-item warning"><strong>Potential Adversaries:</strong> Text found in Notes, but no groups parsed.</div>`;
        }

      } else {
        html += show("Motives", data.motivesAndTactics);
      }

      // Features
      if (items.length > 0) {
        let featList = '<ul class="dh-preview-sublist">';
        for (const item of items) {
          const isCompendium = item.flags?.dhImporter?.isCompendium;
          const sourceLabel = isCompendium ? "<strong>(Compendium)</strong>" : "(New)";
          const colorClass = isCompendium ? "color:var(--color-text-hyperlink)" : "";

          featList += `<li style="${colorClass}"><strong>${item.name}</strong> ${sourceLabel}</li>`;
        }
        featList += '</ul>';
        html += `<div class="dh-preview-item success"><strong>Features:</strong> Found ${items.length}${featList}</div>`;
      } else {
        html += `<div class="dh-preview-item warning"><strong>Features:</strong> None detected</div>`;
      }

      // Fechar div do bloco se múltiplos
      if (isMultiple) {
        html += `</div>`;
      }

      fullHtml += html;
    }

    previewBox.innerHTML = fullHtml;
  }

  static async _onParse(event, target) {
    const formElement = this.element;
    const textarea = formElement.querySelector("textarea[name='statblockText']");
    const modeSelect = formElement.querySelector("select[name='importMode']");

    if (!textarea || !textarea.value.trim()) {
      ui.notifications.warn("Please paste some text first.");
      return;
    }

    const text = textarea.value.trim();
    const forceActorType = modeSelect?.value || "adversary";
    const blocks = StatblockImporter.splitStatblocks(text);
    const isMultiple = blocks.length > 1;

    try {
      const createdActors = [];

      for (const block of blocks) {
        const result = await StatblockImporter.parseStatblockData(block, forceActorType);

        const actorData = {
          name: result.name,
          type: result.actorType,
          system: result.systemData,
          items: result.items,
          img: result.actorType === "environment"
            ? "icons/environment/wilderness/cave-entrance.webp"
            : "modules/dh-statblock-importer/assets/images/skull.webp"
        };

        const newActor = await Actor.create(actorData);
        if (newActor) {
          createdActors.push(newActor);
        }
      }

      // Se único, abrir a sheet
      if (createdActors.length === 1) {
        createdActors[0].sheet.render(true);
      }

    } catch (error) {
      console.error("DH Importer | Error creating actor:", error);
    }
  }

  /* -------------------------------------------- */
  /* Parsing Logic                               */
  /* -------------------------------------------- */

  /**
   * Detecta e divide múltiplos statblocks em um texto.
   * Retorna um array de strings, cada uma contendo um statblock completo.
   */
  static splitStatblocks(text) {
    const lines = text.split(/\r?\n/);
    // Aceita qualquer tipo após "Tier X", incluindo Horde com HP
    const tierRegex = /^Tier\s+\d+\s+\S+(?:\s*\(\d+\/HP\))?$/i;

    // Encontrar índices onde começam novos statblocks (linha do Tier)
    const tierIndices = [];
    for (let i = 0; i < lines.length; i++) {
      if (tierRegex.test(lines[i].trim())) {
        tierIndices.push(i);
      }
    }

    // Se houver 0 ou 1 tier, retornar o texto original como único bloco
    if (tierIndices.length <= 1) {
      return [text];
    }

    // Dividir em blocos - cada bloco começa na linha ANTERIOR ao Tier (nome do ator)
    const blocks = [];
    for (let i = 0; i < tierIndices.length; i++) {
      const nameLineIndex = tierIndices[i] - 1;
      const startIndex = nameLineIndex >= 0 ? nameLineIndex : tierIndices[i];
      const endIndex = (i + 1 < tierIndices.length) ? tierIndices[i + 1] - 1 : lines.length;

      const blockLines = lines.slice(startIndex, endIndex);
      const blockText = blockLines.join("\n").trim();

      if (blockText.length > 0) {
        blocks.push(blockText);
      }
    }

    return blocks;
  }

  static async parseStatblockData(text, forceActorType = null) {
      StatblockImporter.registerSettings();

      const rawLines = text.split(/\r?\n/)
                        .map(l => l.trim())
                        .filter(l => l.length > 0);

      if (rawLines.length === 0) throw new Error("Text content is empty.");

      // --- SETUP DE COMPENDIUMS (FEATURES) ---
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

      // --- SETUP DE COMPENDIUMS (ADVERSARIES) ---
      // Usado para Potential Adversaries lookup
      const selectedActorPacks = game.settings.get("dh-statblock-importer", "selectedActorCompendiums") || ["daggerheart.adversaries"];
      let adversaryIndex = [];

      for (const packId of selectedActorPacks) {
          const pack = game.packs.get(packId);
          if (pack) {
              const index = await pack.getIndex({fields: ["name", "type"]});
              // Combina todos os índices em um único array
              index.forEach(i => adversaryIndex.push(i));
          }
      }

      // --- SETUP INICIAL ---

      const name = rawLines[0];

      // Use forced actor type from combobox
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

      // --- PARSING MULTILINHA ---
      
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

          // 1. Tier/Type e Horde HP
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

              captureState = "description";
              continue;
          }

          // 2. Marcadores de Início de Buffer
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

          // 3. Stat Line
          if (isStatLine(line)) {
              const parts = line.split("|").map(p => p.trim()).filter(p => p.length > 0);
              statSegments.push(...parts);
              continue; 
          }

          // 4. Texto Livre
          if (i > 0 && captureState !== "none") {
              if (captureState === "description") descriptionBuffer.push(line);
              else if (captureState === "motives") motivesBuffer.push(line);
              else if (captureState === "impulses") impulsesBuffer.push(line);
              else if (captureState === "potential") potentialAdvBuffer.push(line);
          }
      }

      // --- ESTRUTURAÇÃO DOS DADOS ---
      
      if (descriptionBuffer.length > 0) systemData.description = descriptionBuffer.join(" ");
      
      if (actorType === "environment") {
          // Environments
          if (impulsesBuffer.length > 0) systemData.impulses = impulsesBuffer.join(" ");
          
          // --- LÓGICA DE POTENTIAL ADVERSARIES ---
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

                  // Busca UUIDs nos compêndios de atores configurados
                  for (const actorName of actorNames) {
                      const found = adversaryIndex.find(a => a.name.toLowerCase() === actorName.toLowerCase() && a.type === "adversary");
                      if (found) {
                          foundUuids.push(found.uuid);
                      }
                  }

                  const groupId = foundry.utils.randomID();
                  systemData.potentialAdversaries[groupId] = {
                      label: groupLabel,
                      adversaries: foundUuids
                  };
              }
          }
      } else {
          // Adversaries
          if (motivesBuffer.length > 0) systemData.motivesAndTactics = motivesBuffer.join(" ");
          
          systemData.resources = { hitPoints: { value: 0 }, stress: { value: 0 } };
          systemData.attack = { roll: {}, img: "icons/magic/death/skull-humanoid-white-blue.webp", damage: { parts: [], includeBase: false, direct: false } };
          systemData.experiences = {};
      }

      // --- PROCESSAR SEGMENTOS (Comum) ---
      for (let segment of statSegments) {
          const difficultyMatch = segment.match(/Diffi\s*culty:\s*(\d+)/i);
          if (difficultyMatch) systemData.difficulty = parseInt(difficultyMatch[1], 10);

          if (actorType === "environment") continue;

          // --- STATS DE ADVERSARY ---
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

          const damageDiceRegex = /^(\d+)d(\d+)([+-]\d+)?\s+(.+)$/i;
          const damageStaticRegex = /^(\d+)\s+(.+)$/i;
          let dmgMatch = segment.match(damageDiceRegex);
          let isStatic = false;
          if (!dmgMatch) { dmgMatch = segment.match(damageStaticRegex); isStatic = !!dmgMatch; }

          if (dmgMatch) {
              const types = [];
              const rawTypes = (isStatic ? dmgMatch[2] : dmgMatch[4]).split("/").map(t => t.trim().toLowerCase());
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
                  damagePart.value.flatMultiplier = parseInt(dmgMatch[1], 10);
                  damagePart.value.dice = `d${dmgMatch[2]}`;
                  if (dmgMatch[3]) damagePart.value.bonus = parseInt(dmgMatch[3], 10);
              }
              if (types.length > 0) systemData.attack.damage.parts = [damagePart];
          }
          
           // Experience
            if (segment.startsWith("Experience:")) {
                const expContent = segment.substring("Experience:".length).trim();
                const expItems = expContent.split(",").map(e => e.trim());
    
                for (let item of expItems) {
                    const expMatch = item.match(/(.+?)\s+([+-]?\d+)$/);
                    if (expMatch) {
                        const expName = expMatch[1].trim();
                        const expValue = parseInt(expMatch[2], 10);
                        const id = foundry.utils.randomID();
                        
                        systemData.experiences[id] = {
                            name: expName,
                            value: expValue,
                            description: ""
                        };
                    }
                }
            }
      }

      // --- PARSING DE FEATURES ---
      let currentFeature = null;

      const pushCurrentFeature = async () => {
          if (!currentFeature) return;

          const found = featureIndexMap.get(currentFeature.name.toLowerCase());
          if (found) {
              const doc = await found.pack.getDocument(found.uuid);
              if (doc) {
                  const itemData = doc.toObject();
                  foundry.utils.mergeObject(itemData, { flags: { dhImporter: { isCompendium: true } } });
                  items.push(itemData);
                  return; 
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

          currentFeature.system.description = finalDesc;
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
                  let desc = currentFeature.system.description.replace("</p>", ""); // Abre a tag
                  
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