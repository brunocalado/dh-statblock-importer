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
            template: "modules/dh-statblock-importer/templates/exporter.hbs"
        }
    };

    /** Currently dropped actor */
    _droppedActor = null;

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
     * Handle the drop event
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

        if (data.type !== "Actor") {
            ui.notifications.warn("Please drop an Actor.");
            return;
        }

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

        // Check if it's an adversary or environment
        if (actor.type !== "adversary" && actor.type !== "environment") {
            ui.notifications.warn("Only Adversary or Environment actors are supported.");
            return;
        }

        this._droppedActor = actor;
        this._updateDropZoneDisplay();
        // Added await here because generation is now async
        await this._generateStatblock();
    }

    /**
     * Update the drop zone to show the dropped actor
     */
    _updateDropZoneDisplay() {
        const placeholder = this.element.querySelector(".dh-drop-placeholder");
        const droppedDisplay = this.element.querySelector(".dh-dropped-actor");

        if (this._droppedActor) {
            placeholder.style.display = "none";
            droppedDisplay.style.display = "flex";

            const img = droppedDisplay.querySelector(".dh-dropped-img");
            const name = droppedDisplay.querySelector(".dh-dropped-name");
            const type = droppedDisplay.querySelector(".dh-dropped-type");

            img.src = this._droppedActor.img;
            name.textContent = this._droppedActor.name;

            const actorType = this._droppedActor.type.charAt(0).toUpperCase() + this._droppedActor.type.slice(1);
            const subType = this._droppedActor.system.type
                ? (this._droppedActor.system.type.charAt(0).toUpperCase() + this._droppedActor.system.type.slice(1))
                : "";
            type.textContent = subType ? `${actorType} - ${subType}` : actorType;
        } else {
            placeholder.style.display = "flex";
            droppedDisplay.style.display = "none";
        }
    }

    /**
     * Generate the statblock text from the dropped actor
     * Now Async to handle Potential Adversaries lookup
     */
    async _generateStatblock() {
        if (!this._droppedActor) return;

        const textarea = this.element.querySelector("textarea[name='statblockOutput']");
        if (!textarea) return;

        // Show loading state if needed, or just wait
        textarea.value = "Generating statblock...";

        let statblock = "";
        try {
            if (this._droppedActor.type === "adversary") {
                statblock = this._formatAdversary(this._droppedActor);
            } else if (this._droppedActor.type === "environment") {
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
        if (sys.type === "horde" && sys.hordeHp) {
            lines.push(`Tier ${tier} Horde (${sys.hordeHp}/HP)`);
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

        const thresholds = sys.damageThresholds;
        if (thresholds?.major || thresholds?.severe) {
            statParts.push(`Thresholds: ${thresholds.major || "?"}/${thresholds.severe || "?"}`);
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
            if (attack.roll?.bonus !== undefined && attack.roll?.bonus !== null) {
                const bonus = attack.roll.bonus;
                atkParts.push(`ATK: ${bonus >= 0 ? "+" + bonus : bonus}`);
            }

            // Weapon name and range
            if (attack.name) {
                const range = attack.range ? this._formatRange(attack.range) : "";
                atkParts.push(`${attack.name}: ${range}`);
            }

            // Damage
            if (attack.damage?.parts?.length > 0) {
                const dmgPart = attack.damage.parts[0];
                const dmgStr = this._formatDamage(dmgPart);
                if (dmgStr) atkParts.push(dmgStr);
            }

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
                
                // Logic to append Horde damage if actor is horde and feature is named "Horde"
                if (sys.type === "horde" && featureName.trim().toLowerCase() === "horde") {
                    const dmgPart = sys.attack?.damage?.parts?.[0];
                    if (dmgPart?.valueAlt) {
                        const val = dmgPart.valueAlt;
                        let diceStr = "";
                        
                        if (val.custom?.enabled && val.custom?.formula) {
                            diceStr = val.custom.formula;
                        } else if (val.dice) {
                            const mult = val.flatMultiplier ?? 1;
                            const bonus = val.bonus ? (val.bonus > 0 ? `+${val.bonus}` : `${val.bonus}`) : "";
                            diceStr = `${mult}${val.dice}${bonus}`;
                        }
                        
                        // Append dice to feature name
                        if (diceStr) {
                            featureName = `Horde (${diceStr})`;
                        }
                    }
                }

                const featureForm = feature.system.featureForm || "passive";
                const formLabel = featureForm.charAt(0).toUpperCase() + featureForm.slice(1);
                const desc = this._stripHtml(feature.system.description || "", actorName);
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
                const desc = this._stripHtml(feature.system.description || "", actorName);
                lines.push(`${feature.name} - ${formLabel}: ${desc}`);
            }
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
            const mult = val.flatMultiplier > 1 ? val.flatMultiplier : "";
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
            ui.notifications.warn("No statblock to copy. Drop an actor first.");
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