const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class StatblockConfig extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "dh-statblock-config",
        tag: "form",
        window: {
            title: "Importer Configuration",
            icon: "fas fa-cog",
            resizable: false,
            width: 450,
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
    }

    /**
     * Handle Tab Switching
     */
    _onTabClick(event) {
        event.preventDefault();
        const target = event.currentTarget;

        console.log("DH Config | Tab Click Triggered");

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

        // Força recalculo da altura da janela
        this.setPosition({ height: "auto" });
    }

    async _prepareContext(options) {
        // --- Features (Items) ---
        const selectedFeatureIds = game.settings.get("dh-statblock-importer", "selectedCompendiums") || [];

        const defaultFeaturePack = "dh-statblock-importer.all-features";
        if (selectedFeatureIds.length === 0 && !game.settings.get("dh-statblock-importer", "configInitialized")) {
            selectedFeatureIds.push(defaultFeaturePack);
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

        const defaultActorPack = "daggerheart.adversaries";
        if (selectedActorIds.length === 0 && !game.settings.get("dh-statblock-importer", "configInitialized")) {
            if (game.packs.get(defaultActorPack)) selectedActorIds.push(defaultActorPack);
        }

        const actorCompendiums = game.packs
            .filter(p => p.metadata.type === "Actor")
            .map(p => ({
                id: p.metadata.id,
                title: p.metadata.label,
                selected: selectedActorIds.includes(p.metadata.id)
            }))
            .sort((a, b) => a.title.localeCompare(b.title));

        return { featureCompendiums, actorCompendiums };
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

        await game.settings.set("dh-statblock-importer", "configInitialized", true);

        ui.notifications.info("Statblock Importer configuration saved.");
    }
}
