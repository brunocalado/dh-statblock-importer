const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class StatblockConfig extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "dh-statblock-config",
        tag: "form",
        window: {
            title: "Importer Configuration",
            icon: "fas fa-cog",
            resizable: false,
            width: 520,
            height: "auto"
        },
        form: {
            handler: StatblockConfig.formHandler,
            submitOnChange: false,
            closeOnSubmit: true
        }
    };

    static PARTS = {
        form: {
            template: "modules/dh-statblock-importer/templates/config.hbs"
        }
    };

    /**
     * Registra event listeners após o render
     */
    _onRender(context, options) {
        super._onRender(context, options);

        const tabButtons = this.element.querySelectorAll(".dh-config-tab-btn");
        tabButtons.forEach(btn => {
            btn.addEventListener("click", (event) => this._onTabClick(event));
        });

        // FilePicker buttons for icon settings
        const iconPickerButtons = this.element.querySelectorAll(".dh-icon-picker-btn");
        iconPickerButtons.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetName = btn.dataset.target;
                const input = this.element.querySelector(`input[name="${targetName}"]`);
                const preview = this.element.querySelector(`.dh-icon-preview[data-target="${targetName}"]`);

                new foundry.applications.apps.FilePicker({
                    type: "image",
                    current: input?.value || "",
                    callback: (path) => {
                        if (input) input.value = path;
                        if (preview) preview.src = path;
                    }
                }).render(true);
            });
        });
    }

    /**
     * Handle Tab Switching
     */
    _onTabClick(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const targetTab = target.dataset.target;

        // Remove active de todos
        const buttons = this.element.querySelectorAll(".dh-config-tab-btn");
        const contents = this.element.querySelectorAll(".dh-config-tab-content");

        buttons.forEach(el => el.classList.remove("active"));
        contents.forEach(el => el.classList.remove("active"));

        // Ativa o alvo
        target.classList.add("active");
        const content = this.element.querySelector(`.dh-config-tab-content[data-tab="${targetTab}"]`);

        if (content) {
            content.classList.add("active");
        }
    }

    async _prepareContext(options) {
        // --- Features (Items) ---
        const selectedFeatureIds = game.settings.get("dh-statblock-importer", "selectedCompendiums") || [];

        const defaultFeaturePacks = ["dh-statblock-importer.all-features", "the-void-unofficial.void-adv-features"];
        if (selectedFeatureIds.length === 0 && !game.settings.get("dh-statblock-importer", "configInitialized")) {
            for (const packId of defaultFeaturePacks) {
                if (game.packs.get(packId)) selectedFeatureIds.push(packId);
            }
        }

        const featureCompendiums = game.packs
            .filter(p => p.metadata.type === "Item")
            .map(p => ({
                id: p.metadata.id,
                title: p.metadata.label,
                selected: selectedFeatureIds.includes(p.metadata.id)
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        // --- Actors ---
        const selectedActorIds = game.settings.get("dh-statblock-importer", "selectedActorCompendiums") || [];

        const defaultActorPacks = ["daggerheart.adversaries", "the-void-unofficial.adversaries--environments"];
        if (selectedActorIds.length === 0 && !game.settings.get("dh-statblock-importer", "configInitialized")) {
            for (const packId of defaultActorPacks) {
                if (game.packs.get(packId)) selectedActorIds.push(packId);
            }
        }

        const actorCompendiums = game.packs
            .filter(p => p.metadata.type === "Actor")
            .map(p => ({
                id: p.metadata.id,
                title: p.metadata.label,
                selected: selectedActorIds.includes(p.metadata.id)
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        // --- General Settings ---
        const adversaryFolderName = game.settings.get("dh-statblock-importer", "adversaryFolderName");
        const environmentFolderName = game.settings.get("dh-statblock-importer", "environmentFolderName");
        const lootFolderName = game.settings.get("dh-statblock-importer", "lootFolderName");
        const consumableFolderName = game.settings.get("dh-statblock-importer", "consumableFolderName");
        const weaponFolderName = game.settings.get("dh-statblock-importer", "weaponFolderName");
        const armorFolderName = game.settings.get("dh-statblock-importer", "armorFolderName");
        const featureFolderName = game.settings.get("dh-statblock-importer", "featureFolderName");
        const domainCardFolderName = game.settings.get("dh-statblock-importer", "domainCardFolderName");
        const separatorMode = game.settings.get("dh-statblock-importer", "separatorMode") || "blankLine";

        const featureIconAdversary = game.settings.get("dh-statblock-importer", "featureIconAdversary");
        const featureIconEnvironment = game.settings.get("dh-statblock-importer", "featureIconEnvironment");
        const featureIconFeature = game.settings.get("dh-statblock-importer", "featureIconFeature");
        const featureIconMatchAdversary = game.settings.get("dh-statblock-importer", "featureIconMatchAdversary");
        const featureIconMatchEnvironment = game.settings.get("dh-statblock-importer", "featureIconMatchEnvironment");

        return {
            featureCompendiums,
            actorCompendiums,
            adversaryFolderName,
            environmentFolderName,
            lootFolderName,
            consumableFolderName,
            weaponFolderName,
            armorFolderName,
            featureFolderName,
            domainCardFolderName,
            separatorMode,
            featureIconAdversary,
            featureIconEnvironment,
            featureIconFeature,
            featureIconMatchAdversary,
            featureIconMatchEnvironment
        };
    }

    static async formHandler(event, form, formData) {
        // Salvar Features
        const selectedFeatures = [];
        const featureChecks = form.querySelectorAll("input[name='featureCompendiums']:checked");
        featureChecks.forEach(cb => selectedFeatures.push(cb.value));
        await game.settings.set("dh-statblock-importer", "selectedCompendiums", selectedFeatures);

        // Salvar Actors
        const selectedActors = [];
        const actorChecks = form.querySelectorAll("input[name='actorCompendiums']:checked");
        actorChecks.forEach(cb => selectedActors.push(cb.value));
        await game.settings.set("dh-statblock-importer", "selectedActorCompendiums", selectedActors);

        // Salvar General Settings (Folder Names)
        const adversaryFolderInput = form.querySelector("input[name='adversaryFolderName']");
        const environmentFolderInput = form.querySelector("input[name='environmentFolderName']");
        const lootFolderInput = form.querySelector("input[name='lootFolderName']");
        const consumableFolderInput = form.querySelector("input[name='consumableFolderName']");
        const weaponFolderInput = form.querySelector("input[name='weaponFolderName']");
        const armorFolderInput = form.querySelector("input[name='armorFolderName']");
        const featureFolderInput = form.querySelector("input[name='featureFolderName']");
        const domainCardFolderInput = form.querySelector("input[name='domainCardFolderName']");
        const separatorModeInput = form.querySelector("select[name='separatorMode']");

        if (adversaryFolderInput?.value) await game.settings.set("dh-statblock-importer", "adversaryFolderName", adversaryFolderInput.value);
        if (environmentFolderInput?.value) await game.settings.set("dh-statblock-importer", "environmentFolderName", environmentFolderInput.value);
        if (lootFolderInput?.value) await game.settings.set("dh-statblock-importer", "lootFolderName", lootFolderInput.value);
        if (consumableFolderInput?.value) await game.settings.set("dh-statblock-importer", "consumableFolderName", consumableFolderInput.value);
        if (weaponFolderInput?.value) await game.settings.set("dh-statblock-importer", "weaponFolderName", weaponFolderInput.value);
        if (armorFolderInput?.value) await game.settings.set("dh-statblock-importer", "armorFolderName", armorFolderInput.value);
        if (featureFolderInput?.value) await game.settings.set("dh-statblock-importer", "featureFolderName", featureFolderInput.value);
        if (domainCardFolderInput?.value) await game.settings.set("dh-statblock-importer", "domainCardFolderName", domainCardFolderInput.value);
        if (separatorModeInput?.value) await game.settings.set("dh-statblock-importer", "separatorMode", separatorModeInput.value);

        const featureIconAdversaryInput = form.querySelector("input[name='featureIconAdversary']");
        const featureIconEnvironmentInput = form.querySelector("input[name='featureIconEnvironment']");
        const featureIconFeatureInput = form.querySelector("input[name='featureIconFeature']");
        const featureIconMatchAdversaryInput = form.querySelector("input[name='featureIconMatchAdversary']");
        const featureIconMatchEnvironmentInput = form.querySelector("input[name='featureIconMatchEnvironment']");

        const adversaryIconVal = featureIconAdversaryInput?.value?.trim();
        if (adversaryIconVal) await game.settings.set("dh-statblock-importer", "featureIconAdversary", adversaryIconVal);
        const environmentIconVal = featureIconEnvironmentInput?.value?.trim();
        if (environmentIconVal) await game.settings.set("dh-statblock-importer", "featureIconEnvironment", environmentIconVal);
        const featureIconVal = featureIconFeatureInput?.value?.trim();
        if (featureIconVal) await game.settings.set("dh-statblock-importer", "featureIconFeature", featureIconVal);

        await game.settings.set("dh-statblock-importer", "featureIconMatchAdversary", featureIconMatchAdversaryInput?.checked || false);
        await game.settings.set("dh-statblock-importer", "featureIconMatchEnvironment", featureIconMatchEnvironmentInput?.checked || false);

        await game.settings.set("dh-statblock-importer", "configInitialized", true);
    }
}
