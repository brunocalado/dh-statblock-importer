/*!
 * Daggerheart: Stats Toolbox
 * 2025 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "./constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Statblock Exporter Application - Converts actors to formatted statblock text.
 */
export class StatblockExporter extends HandlebarsApplicationMixin(ApplicationV2) {

    /** @override */
    static DEFAULT_OPTIONS = {
        id: "dh-statblock-exporter",
        tag: "form",
        window: {
            title: "Daggerheart: Statblock Exporter",
            icon: "fas fa-file-export",
            resizable: true,
            contentClasses: ["standard-form"]
        },
        position: {
            width: 800,
            height: 500
        },
        actions: {
            clearActor: StatblockExporter._onClearActor,
            copyStatblock: StatblockExporter._onCopyStatblock
        }
    };

    /** @override */
    static PARTS = {
        form: {
            template: `modules/${MODULE_ID}/templates/exporter.hbs`
        }
    };

    /** Currently dropped actor */
    _droppedActor = null;

    /** Currently dropped item (for class export) */
    _droppedItem = null;

    /* -------------------------------------------- */
    /* Rendering                                    */
    /* -------------------------------------------- */

    /** @override */
    _onRender(context, options) {
        super._onRender(context, options);
        this._setupDropZone();
    }

    /**
     * Setup the drop zone event handlers
     */
    _setupDropZone() {
        const dropZone = this.element.querySelector("#dh-exporter-dropzone");
        if (!dropZone) return;

        dropZone.addEventListener("dragover", (ev) => {
            ev.preventDefault();
            dropZone.classList.add("drag-over");
        });

        dropZone.addEventListener("dragleave", (ev) => {
            ev.preventDefault();
            dropZone.classList.remove("drag-over");
        });

        dropZone.addEventListener("drop", async (ev) => {
            ev.preventDefault();
            dropZone.classList.remove("drag-over");
            await this._handleDrop(ev);
        });
    }

    /**
     * Handle the drop event, supporting both Actor and Item document types.
     * @param {DragEvent} ev
     */
    async _handleDrop(ev) {
        let data;
        try {
            data = JSON.parse(ev.dataTransfer.getData("text/plain"));
        } catch (e) {
            ui.notifications.warn("Invalid drop data.");
            return;
        }

        if (data.type === "Actor") {
            let actor;
            if (data.uuid) {
                actor = await fromUuid(data.uuid);
            } else if (data.id) {
                actor = game.actors.get(data.id);
            }

            if (!actor) {
                ui.notifications.warn("Could not find the actor.");
                return;
            }

            if (actor.type !== "adversary" && actor.type !== "environment") {
                ui.notifications.warn("Only Adversary or Environment actors are supported.");
                return;
            }

            this._droppedActor = actor;
            this._droppedItem = null;

        } else if (data.type === "Item") {
            let item;
            if (data.uuid) {
                item = await fromUuid(data.uuid);
            } else if (data.id) {
                item = game.items.get(data.id);
            }

            if (!item) {
                ui.notifications.warn("Could not find the item.");
                return;
            }

            const supportedItemTypes = ["class", "ancestry", "community"];
            if (!supportedItemTypes.includes(item.type)) {
                ui.notifications.warn("Only Class, Ancestry, or Community items are supported.");
                return;
            }

            this._droppedItem = item;
            this._droppedActor = null;

        } else {
            ui.notifications.warn("Please drop an Actor or an Item.");
            return;
        }

        this._updateDropZoneDisplay();
        await this._generateStatblock();
    }

    /**
     * Update the drop zone to show the dropped actor or item.
     */
    _updateDropZoneDisplay() {
        const placeholder = this.element.querySelector(".dh-drop-placeholder");
        const droppedDisplay = this.element.querySelector(".dh-dropped-actor");
        const doc = this._droppedActor || this._droppedItem;

        if (doc) {
            placeholder.style.display = "none";
            droppedDisplay.style.display = "flex";

            const img = droppedDisplay.querySelector(".dh-dropped-img");
            const name = droppedDisplay.querySelector(".dh-dropped-name");
            const type = droppedDisplay.querySelector(".dh-dropped-type");

            img.src = doc.img;
            name.textContent = doc.name;

            if (this._droppedItem) {
                // Item drops show their document type directly
                type.textContent = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
            } else {
                const actorType = doc.type.charAt(0).toUpperCase() + doc.type.slice(1);
                const subType = doc.system.type
                    ? (doc.system.type.charAt(0).toUpperCase() + doc.system.type.slice(1))
                    : "";
                type.textContent = subType ? `${actorType} - ${subType}` : actorType;
            }
        } else {
            placeholder.style.display = "flex";
            droppedDisplay.style.display = "none";
        }
    }

    /**
     * Generate the statblock text from the dropped actor or item.
     * Async to handle UUID resolution for environments and classes.
     */
    async _generateStatblock() {
        const doc = this._droppedActor || this._droppedItem;
        if (!doc) return;

        const textarea = this.element.querySelector("textarea[name='statblockOutput']");
        if (!textarea) return;

        textarea.value = "Generating statblock...";

        let statblock = "";
        try {
            if (this._droppedItem?.type === "class") {
                statblock = await this._formatClass(this._droppedItem);
            } else if (this._droppedItem?.type === "ancestry") {
                statblock = await this._formatAncestry(this._droppedItem);
            } else if (this._droppedItem?.type === "community") {
                statblock = await this._formatCommunity(this._droppedItem);
            } else if (this._droppedActor?.type === "adversary") {
                statblock = this._formatAdversary(this._droppedActor);
            } else if (this._droppedActor?.type === "environment") {
                statblock = await this._formatEnvironment(this._droppedActor);
            }
            textarea.value = statblock;
        } catch (error) {
            console.error(error);
            textarea.value = "Error generating statblock. Check console.";
        }
    }

    /**
     * Format an adversary actor to statblock text
     * @param {Actor} actor
     * @returns {string}
     */
    _formatAdversary(actor) {
        const sys = actor.system;
        const lines = [];
        const actorName = actor.name;

        // Name (uppercase)
        lines.push(actorName.toUpperCase());

        // Tier and Type (special format for Horde)
        const tier = sys.tier || 1;
        const type = sys.type ? (sys.type.charAt(0).toUpperCase() + sys.type.slice(1)) : "Standard";
        if (sys.type === "horde" && sys.typeData?.hordeHP) {
            lines.push(`Tier ${tier} Horde (${sys.typeData.hordeHP}/HP)`);
        } else {
            lines.push(`Tier ${tier} ${type}`);
        }

        // Description (strip HTML)
        if (sys.description) {
            const desc = this._stripHtml(sys.description, actorName);
            if (desc) lines.push(desc);
        }

        // Motives & Tactics
        if (sys.motivesAndTactics) {
            const motives = this._stripHtml(sys.motivesAndTactics, actorName);
            if (motives) lines.push(`Motives & Tactics: ${motives}`);
        }

        // Stats line: Difficulty | HP | Stress | Thresholds
        const statParts = [];
        if (sys.difficulty) statParts.push(`Difficulty: ${sys.difficulty}`);

        // The system stores a missing threshold as 0; statblocks write it as "None" ("5/None"),
        // and a minion, which has neither, as a bare "None".
        const thresholds = sys.damageThresholds;
        if (thresholds?.major || thresholds?.severe) {
            statParts.push(`Thresholds: ${thresholds.major || "None"}/${thresholds.severe || "None"}`);
        } else {
            statParts.push("Thresholds: None");
        }

        if (sys.resources?.hitPoints?.max) statParts.push(`HP: ${sys.resources.hitPoints.max}`);
        if (sys.resources?.stress?.max) statParts.push(`Stress: ${sys.resources.stress.max}`);

        if (statParts.length > 0) {
            lines.push(statParts.join(" | "));
        }

        // Attack line: ATK | Weapon Name: Range | Damage Type
        const attack = sys.attack;
        if (attack) {
            const atkParts = [];

            // ATK bonus
            // System 2.10.4 made the bonus a formula string ("2", "-1", "2d4"), so sign it textually.
            if (attack.roll?.bonus !== undefined && attack.roll?.bonus !== null && attack.roll.bonus !== "") {
                const bonus = String(attack.roll.bonus).trim();
                atkParts.push(`ATK: ${/^[+-]/.test(bonus) ? bonus : "+" + bonus}`);
            }

            // Weapon name and range
            if (attack.name) {
                const range = attack.range ? this._formatRange(attack.range) : "";
                atkParts.push(`${attack.name}: ${range}`);
            }

            // Damage
            // System 2.x moved the attack's HP damage from the `damage.parts` map into
            // `damage.main`. DHBaseAction.migrateData strips `parts` when the actor loads,
            // so a live actor never exposes it — reading `parts` here returned nothing.
            // Read the stored damage, not the prepared one: at half HP a horde's Horde effect swaps the
            // prepared formula for "@system.typeData.hordeDamage", which is not a statblock value.
            const dmgStr = this._formatDamage(actor._source.system.attack?.damage?.main);
            if (dmgStr) atkParts.push(dmgStr);

            if (atkParts.length > 0) {
                lines.push(atkParts.join(" | "));
            }
        }

        // Experiences
        const experiences = sys.experiences;
        if (experiences && Object.keys(experiences).length > 0) {
            const expStrs = Object.values(experiences).map(exp => {
                const val = exp.value >= 0 ? `+${exp.value}` : `${exp.value}`;
                return `${exp.name} ${val}`;
            });
            if (expStrs.length > 0) {
                lines.push(`Experience: ${expStrs.join(", ")}`);
            }
        }

        // Features
        const features = actor.items.filter(i => i.type === "feature");
        if (features.length > 0) {
            lines.push("FEATURES");
            for (const feature of features) {
                let featureName = feature.name;
                
                // Logic to append Horde damage if actor is horde and feature is named "Horde".
                // System 2.10 stores it as a formula in `typeData.hordeDamage` (was `damage.main.valueAlt`).
                const hordeDamage = sys.typeData?.hordeDamage;
                if (sys.type === "horde" && featureName.trim().toLowerCase() === "horde" && hordeDamage) {
                    featureName = `Horde (${hordeDamage})`;
                }

                const featureForm = feature.system.featureForm || "passive";
                const formLabel = featureForm.charAt(0).toUpperCase() + featureForm.slice(1);
                // Resolve data lookups such as the system horde feature's
                // @Lookup[@system.typeData.hordeDamage]; unresolved ones are left for _stripHtml.
                const rawDesc = (feature.system.description || "").replace(/@Lookup\[@(system\.[^\]]+)\]/g,
                    (match, path) => foundry.utils.getProperty(actor, path) ?? match);
                const desc = this._stripHtml(this._markSecrets(rawDesc), actorName);
                lines.push(`${featureName} - ${formLabel}: ${desc}`);
            }
        }

        return lines.join("\n");
    }

    /**
     * Format an environment actor to statblock text
     * @param {Actor} actor
     * @returns {Promise<string>}
     */
    async _formatEnvironment(actor) {
        const sys = actor.system;
        const lines = [];
        const actorName = actor.name;

        // Name (uppercase)
        lines.push(actorName.toUpperCase());

        // Tier and Type
        const tier = sys.tier || 1;
        const type = sys.type ? (sys.type.charAt(0).toUpperCase() + sys.type.slice(1)) : "Exploration";
        lines.push(`Tier ${tier} ${type}`);

        // Description (strip HTML)
        if (sys.description) {
            const desc = this._stripHtml(sys.description, actorName);
            if (desc) lines.push(desc);
        }

        // Impulses
        if (sys.impulses) {
            const impulses = this._stripHtml(sys.impulses, actorName);
            if (impulses) lines.push(`Impulses: ${impulses}`);
        }

        // Difficulty
        if (sys.difficulty) {
            lines.push(`Difficulty: ${sys.difficulty}`);
        }

        // Potential Adversaries - Needs Async Lookup
        const potAdv = sys.potentialAdversaries;
        if (potAdv && Object.keys(potAdv).length > 0) {
            const groups = [];
            
            // Iterate over each group (e.g. Beasts, Guardians)
            for (const group of Object.values(potAdv)) {
                // Determine adversaries list (might be Array or Set in some DataModels)
                const rawAdversaries = group.adversaries instanceof Set 
                    ? Array.from(group.adversaries) 
                    : (Array.isArray(group.adversaries) ? group.adversaries : []);

                if (rawAdversaries.length === 0) continue;
                
                const label = group.label || "Group";
                
                // Fetch names for all UUIDs in this group
                const namePromises = rawAdversaries.map(async (entry) => {
                    // Normalize UUID: entry might be string or object {uuid: "..."}
                    const uuid = (typeof entry === 'object' && entry?.uuid) ? entry.uuid : entry;
                    
                    if (!uuid || typeof uuid !== 'string') return "Invalid UUID";

                    try {
                        let actorDoc = await fromUuid(uuid);
                        
                        // Fallback 1: If fromUuid returns null, try searching World Actors by ID
                        if (!actorDoc) {
                            const idParts = uuid.split(".");
                            const id = idParts[idParts.length - 1]; // Get last part as ID
                            actorDoc = game.actors.get(id);
                        }

                        if (actorDoc) return actorDoc.name;

                        // Log failure for debugging
                        console.warn(`Statblock Exporter | Failed to resolve adversary UUID: ${uuid}`);
                        return "Unknown Actor";

                    } catch (err) {
                        console.error(`Statblock Exporter | Error fetching UUID ${uuid}:`, err);
                        return "Unknown Actor";
                    }
                });
                
                const names = await Promise.all(namePromises);
                
                // Format: Label (Name1, Name2, Name3)
                groups.push(`${label} (${names.join(", ")})`);
            }

            if (groups.length > 0) {
                lines.push(`Potential Adversaries: ${groups.join(", ")}`);
            }
        }

        // Features
        const features = actor.items.filter(i => i.type === "feature");
        if (features.length > 0) {
            lines.push("FEATURES");
            for (const feature of features) {
                const featureForm = feature.system.featureForm || "passive";
                const formLabel = featureForm.charAt(0).toUpperCase() + featureForm.slice(1);
                const desc = this._stripHtml(this._markSecrets(feature.system.description || ""), actorName);
                lines.push(`${feature.name} - ${formLabel}: ${desc}`);
            }
        }

        return lines.join("\n");
    }

    /**
     * Resolve an item document from a UUID string, with fallback to the world items collection.
     * @param {string} uuid - Compendium or world UUID
     * @returns {Promise<Item|null>}
     */
    async _resolveItem(uuid) {
        if (!uuid || typeof uuid !== "string") return null;
        try {
            let doc = await fromUuid(uuid);
            if (!doc) {
                const idParts = uuid.split(".");
                const id = idParts[idParts.length - 1];
                doc = game.items.get(id);
            }
            if (!doc) {
                console.warn(`Statblock Exporter | Failed to resolve item UUID: ${uuid}`);
            }
            return doc;
        } catch (err) {
            console.error(`Statblock Exporter | Error fetching item UUID ${uuid}:`, err);
            return null;
        }
    }

    /**
     * Normalize a Foundry DataModel collection (Array, Set, or other iterable) into a plain Array.
     * Foundry's DataModel can convert arrays into Sets, which lack .length and .map().
     * @param {Array|Set|*} collection
     * @returns {Array}
     */
    _toArray(collection) {
        if (Array.isArray(collection)) return collection;
        if (collection instanceof Set) return Array.from(collection);
        if (collection && typeof collection[Symbol.iterator] === "function") return Array.from(collection);
        return [];
    }

    /**
     * Format a class item to a structured plain-text statblock.
     * Resolves nested UUIDs for features, subclasses, and inventory items.
     * @param {Item} item - A Daggerheart class item document
     * @returns {Promise<string>}
     */
    async _formatClass(item) {
        const sys = item.system;
        const lines = [];
        const className = item.name;

        // Header: Class Name (Domain1, Domain2)
        const domains = this._toArray(sys.domains)
            .map(d => d.charAt(0).toUpperCase() + d.slice(1));
        lines.push(`${className} (${domains.join(", ")})`);

        // HP and Evasion
        const statParts = [];
        if (sys.hitPoints !== undefined) statParts.push(`HP: ${sys.hitPoints}`);
        if (sys.evasion !== undefined) statParts.push(`Evasion: ${sys.evasion}`);
        if (statParts.length > 0) lines.push(statParts.join(" | "));

        // Suggested Traits from characterGuide
        const traits = sys.characterGuide?.suggestedTraits;
        if (traits && typeof traits === "object") {
            const traitLine = Object.entries(traits)
                .map(([key, val]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${val}`)
                .join(" ");
            if (traitLine) lines.push(traitLine);
        }

        // Description
        if (sys.description) {
            const desc = this._stripHtml(sys.description, className);
            if (desc) lines.push(desc);
        }

        // Inventory section header
        lines.push("");
        lines.push("INVENTORY");

        // Suggested Equipment from characterGuide (weapon/armor references)
        const guide = sys.characterGuide;
        if (guide) {
            const equipNames = [];
            const refs = [guide.suggestedPrimaryWeapon, guide.suggestedSecondaryWeapon, guide.suggestedArmor];
            for (const ref of refs) {
                if (!ref) continue;
                const name = (typeof ref === "object") ? ref.name : null;
                if (name) {
                    equipNames.push(name);
                } else if (typeof ref === "string") {
                    const doc = await this._resolveItem(ref);
                    if (doc) equipNames.push(doc.name);
                }
            }
            if (equipNames.length > 0) {
                lines.push(`Suggested Equipment: ${equipNames.join(", ")}`);
            }
        }

        // Inventory lists hold plain UUID strings (system 2.12), so resolve them through the class model.
        const inventory = await sys.fetchInventoryChoices();
        const inventoryLines = [
            ["Starting Items", inventory.take, ", "],         // items the class always grants
            ["Common Items Choice", inventory.choiceA, " or "], // pick one consumable
            ["Class Items Choice", inventory.choiceB, " or "]   // pick one class-specific item
        ];
        for (const [label, docs, separator] of inventoryLines) {
            const names = docs.filter(Boolean).map(d => d.name);
            if (names.length > 0) lines.push(`${label}: ${names.join(separator)}`);
        }

        // Features - separated by type (hope vs class)
        // entry.item is a non-enumerable getter returning an index entry object with .uuid
        const featuresList = this._toArray(sys.features);
        if (featuresList.length > 0) {
            let hopeFeature = null;
            const classFeatures = [];

            for (const entry of featuresList) {
                const featureRef = entry.item;
                const featureUuid = (typeof featureRef === "object") ? featureRef?.uuid : featureRef;
                const featureDoc = featureUuid ? await this._resolveItem(featureUuid) : null;
                if (!featureDoc) continue;

                const fName = featureDoc.name;
                const fDesc = this._stripHtml(featureDoc.system?.description || "", className);

                if (entry.type === "hope") {
                    hopeFeature = { name: fName, desc: fDesc };
                } else {
                    classFeatures.push({ name: fName, desc: fDesc });
                }
            }

            lines.push("");

            if (hopeFeature) {
                lines.push(`Hope Feature: ${hopeFeature.name}: ${hopeFeature.desc}`);
            }

            if (classFeatures.length > 0) {
                lines.push("CLASS FEATURES");
                for (const f of classFeatures) {
                    lines.push(`${f.name}: ${f.desc}`);
                }
            }
        }

        // Subclasses - a class does not store them; each subclass points back through system.linkedClass
        const subclassList = await sys.fetchSubclasses();
        if (subclassList.length > 0) {
            lines.push("");
            lines.push("SUBCLASSES");

            for (const subclass of subclassList) {
                lines.push("");
                lines.push(subclass.name);

                if (subclass.system?.spellcastingTrait) {
                    const trait = subclass.system.spellcastingTrait;
                    lines.push(`Spellcasting Trait: ${trait.charAt(0).toUpperCase() + trait.slice(1)}`);
                }

                if (subclass.system?.description) {
                    const scDesc = this._stripHtml(subclass.system.description, className);
                    if (scDesc) lines.push(scDesc);
                }

                // Subclass features grouped by tier (foundation/specialization/mastery)
                const scFeatures = this._toArray(subclass.system?.features);
                if (scFeatures.length > 0) {
                    const grouped = { foundation: [], specialization: [], mastery: [] };

                    for (const entry of scFeatures) {
                        const featureRef = entry.item;
                        const featureUuid = (typeof featureRef === "object") ? featureRef?.uuid : featureRef;
                        const featureDoc = featureUuid ? await this._resolveItem(featureUuid) : null;
                        if (!featureDoc) continue;

                        const fName = featureDoc.name;
                        const fDesc = this._stripHtml(featureDoc.system?.description || "", className);
                        const tier = entry.type || "foundation";

                        if (grouped[tier]) {
                            grouped[tier].push({ name: fName, desc: fDesc });
                        }
                    }

                    const hasAnyFeatures = Object.values(grouped).some(arr => arr.length > 0);
                    if (hasAnyFeatures) {
                        lines.push("Features:");
                        for (const [tier, features] of Object.entries(grouped)) {
                            if (features.length === 0) continue;
                            lines.push(`${tier.charAt(0).toUpperCase() + tier.slice(1)}:`);
                            for (const f of features) {
                                lines.push(`${f.name}: ${f.desc}`);
                            }
                        }
                    }
                }
            }
        }

        // Background Questions
        const bgQuestions = this._toArray(sys.backgroundQuestions);
        if (bgQuestions.length > 0) {
            lines.push("");
            lines.push("Background Questions:");
            bgQuestions.forEach((q, i) => {
                const cleanQ = this._stripHtml(q, className);
                if (cleanQ) lines.push(`${i + 1}. ${cleanQ}`);
            });
        }

        // Connections
        const connections = this._toArray(sys.connections);
        if (connections.length > 0) {
            lines.push("");
            lines.push("Connections:");
            connections.forEach((c, i) => {
                const cleanC = this._stripHtml(c, className);
                if (cleanC) lines.push(`${i + 1}. ${cleanC}`);
            });
        }

        return lines.join("\n");
    }

    /**
     * Format an ancestry item to plain-text statblock.
     * Resolves feature UUIDs for name and description.
     * @param {Item} item - A Daggerheart ancestry item document
     * @returns {Promise<string>}
     */
    async _formatAncestry(item) {
        const sys = item.system;
        const lines = [];

        lines.push(item.name);

        if (sys.description) {
            const desc = this._stripHtml(sys.description, item.name);
            if (desc) lines.push(desc);
        }

        // Ancestry features: array of {type, item} where item is a getter returning index entry
        const featuresList = this._toArray(sys.features);
        for (const entry of featuresList) {
            const featureRef = entry.item || entry;
            const featureUuid = (typeof featureRef === "object") ? featureRef?.uuid : featureRef;
            const featureDoc = featureUuid ? await this._resolveItem(featureUuid) : null;
            if (!featureDoc) continue;

            const fName = featureDoc.name;
            const fDesc = this._stripHtml(featureDoc.system?.description || "", item.name);
            lines.push(`${fName}: ${fDesc}`);
        }

        return lines.join("\n");
    }

    /**
     * Format a community item to plain-text statblock.
     * Resolves feature UUIDs for name and description.
     * @param {Item} item - A Daggerheart community item document
     * @returns {Promise<string>}
     */
    async _formatCommunity(item) {
        const sys = item.system;
        const lines = [];

        lines.push(item.name);

        if (sys.description) {
            const desc = this._stripHtml(sys.description, item.name);
            if (desc) lines.push(desc);
        }

        // Community features: can be plain UUID strings or {item} objects
        const featuresList = this._toArray(sys.features);
        for (const entry of featuresList) {
            const featureRef = entry.item || entry;
            const featureUuid = (typeof featureRef === "object") ? featureRef?.uuid : featureRef;
            const featureDoc = featureUuid ? await this._resolveItem(featureUuid) : null;
            if (!featureDoc) continue;

            const fName = featureDoc.name;
            const fDesc = this._stripHtml(featureDoc.system?.description || "", item.name);
            lines.push(`${fName}: ${fDesc}`);
        }

        return lines.join("\n");
    }

    /**
     * Strip HTML tags from a string and replace @Lookup[@name] with actor name.
     * Also replaces @UUID[...] links with just their label/name.
     * @param {string} html
     * @param {string} actorName - The actor's name to replace @Lookup[@name] with
     * @returns {string}
     */
    /**
     * Turn secret blocks into the importer's *marker* so an exported statblock re-imports with its secrets.
     * @param {string} html
     * @returns {string}
     */
    _markSecrets(html) {
        if (game.settings.get(MODULE_ID, "secretPrompts") === "off") return html;
        return html.replace(/<section[^>]*class="secret"[^>]*>([\s\S]*?)<\/section>/g,
            (match, inner) => ` *${inner.replace(/<[^>]+>/g, "").trim()}*`);
    }

    _stripHtml(html, actorName = "") {
        if (!html) return "";
        // Replace common HTML patterns
        let text = html
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<\/p>\s*<p>/gi, " ")
            .replace(/<li>/gi, "- ")
            .replace(/<\/li>/gi, " ")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/\[\[\/r\s+([^\]]+)\]\]/g, "$1") // Remove [[/r ]] wrappers
            .replace(/@Lookup\[@name\]/gi, actorName) // Replace @Lookup[@name] with actor name
            // Remove @UUID links, keeping only the text inside {}
            // Example: @UUID[Compendium...]{Sylvan Soldiers} -> Sylvan Soldiers
            .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, "$1") 
            .replace(/\s+/g, " ")
            .trim();
        return text;
    }

    /**
     * Format a range value
     * @param {string} range
     * @returns {string}
     */
    _formatRange(range) {
        const rangeMap = {
            "melee": "Melee",
            "veryClose": "Very Close",
            "close": "Close",
            "far": "Far",
            "veryFar": "Very Far"
        };
        return rangeMap[range] || range;
    }

    /**
     * Format damage from a damage part
     * Checks the 'type' array to properly format 'phy', 'mag', or 'phy/mag'
     * @param {object} dmgPart
     * @returns {string}
     */
    _formatDamage(dmgPart) {
        if (!dmgPart) return "";

        const val = dmgPart.value;
        let diceStr = "";

        if (val.custom?.enabled && val.custom?.formula) {
            diceStr = val.custom.formula;
        } else if (val.dice) {
            // Statblocks always spell the dice count out ("1d10+2", never "d10+2"), which is
            // also the form the importer's parser expects back, so never elide a count of 1.
            const mult = val.flatMultiplier ?? 1;
            const bonus = val.bonus ? (val.bonus > 0 ? `+${val.bonus}` : `${val.bonus}`) : "";
            diceStr = `${mult}${val.dice}${bonus}`;
        }

        // Logic to format damage type (physical/magical)
        // Defensively ensure typeList is an Array to prevent crashes
        let typeList = dmgPart.type || [];

        if (typeof typeList === "string") {
            typeList = [typeList];
        } else if (typeList instanceof Set) {
            typeList = Array.from(typeList);
        } else if (!Array.isArray(typeList)) {
            // Fallback for unexpected objects to avoid "includes is not a function" error
            typeList = [];
        }

        let typeStr = "";

        const hasPhy = typeList.includes("physical");
        const hasMag = typeList.includes("magical");

        if (hasPhy && hasMag) {
            typeStr = "phy/mag";
        } else if (hasPhy) {
            typeStr = "phy";
        } else if (hasMag) {
            typeStr = "mag";
        } else {
            // Fallback for other potential types, capitalizing them
            typeStr = typeList.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join("/");
        }

        if (diceStr && typeStr) {
            return `${diceStr} ${typeStr}`;
        } else if (diceStr) {
            return diceStr;
        }
        return "";
    }

    /* -------------------------------------------- */
    /* Actions                                      */
    /* -------------------------------------------- */

    /**
     * Clear the dropped actor
     */
    static _onClearActor(event, target) {
        this._droppedActor = null;
        this._droppedItem = null;
        this._updateDropZoneDisplay();

        const textarea = this.element.querySelector("textarea[name='statblockOutput']");
        if (textarea) textarea.value = "";
    }

    /**
     * Copy the statblock to clipboard
     */
    static async _onCopyStatblock(event, target) {
        const textarea = this.element.querySelector("textarea[name='statblockOutput']");
        if (!textarea || !textarea.value.trim()) {
            ui.notifications.warn("No statblock to copy. Drop an actor or class item first.");
            return;
        }

        try {
            await navigator.clipboard.writeText(textarea.value);
        } catch (e) {
            // Fallback for older browsers
            textarea.select();
            document.execCommand("copy");
        }
    }
}