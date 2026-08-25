import { MODULE_ID } from "./constants.js";
import { localize, localizeSettingValue, moduleKey } from "./i18n.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class StatblockConfig extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}) {
        super(options);
        this.options.window.title = localize("Config.Title");
    }

    static DEFAULT_OPTIONS = {
        id: "dh-statblock-config",
        tag: "form",
        window: {
            title: moduleKey("Config.Title"),
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
            template: `modules/${MODULE_ID}/templates/config.hbs`
        }
    };

    /**
     * Attach event listeners after render.
     * @param {object} context
     * @param {object} options
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

                const FilePickerClass = foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;
                new FilePickerClass({
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
     * Handle tab switching in the config dialog.
     * @param {MouseEvent} event
     */
    _onTabClick(event) {
        event.preventDefault();
        const target = event.currentTarget;
        const targetTab = target.dataset.target;

        const buttons = this.element.querySelectorAll(".dh-config-tab-btn");
        const contents = this.element.querySelectorAll(".dh-config-tab-content");

        buttons.forEach(el => el.classList.remove("active"));
        contents.forEach(el => el.classList.remove("active"));

        target.classList.add("active");
        const content = this.element.querySelector(`.dh-config-tab-content[data-tab="${targetTab}"]`);

        if (content) {
            content.classList.add("active");
        }
    }

    async _prepareContext(options) {
        // --- Features (Items) ---
        const selectedFeatureIds = game.settings.get(MODULE_ID, "selectedCompendiums") || [];

        const defaultFeaturePack = `${MODULE_ID}.all-features`;
        if (selectedFeatureIds.length === 0 && !game.settings.get(MODULE_ID, "configInitialized")) {
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
        const selectedActorIds = game.settings.get(MODULE_ID, "selectedActorCompendiums") || [];

        const defaultActorPack = "daggerheart.adversaries";
        if (selectedActorIds.length === 0 && !game.settings.get(MODULE_ID, "configInitialized")) {
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

        // --- General Settings ---
        const folderSetting = (settingKey, fallbackPath) =>
            localizeSettingValue(game.settings.get(MODULE_ID, settingKey), fallbackPath);

        const adversaryFolderName = folderSetting("adversaryFolderName", "Folders.importedAdversaries");
        const environmentFolderName = folderSetting("environmentFolderName", "Folders.importedEnvironments");
        const lootFolderName = folderSetting("lootFolderName", "Folders.importedLoot");
        const consumableFolderName = folderSetting("consumableFolderName", "Folders.importedConsumables");
        const weaponFolderName = folderSetting("weaponFolderName", "Folders.importedWeapons");
        const armorFolderName = folderSetting("armorFolderName", "Folders.importedArmors");
        const featureFolderName = folderSetting("featureFolderName", "Folders.importedFeatures");
        const domainCardFolderName = folderSetting("domainCardFolderName", "Folders.importedDomainCards");
        const separatorMode = game.settings.get(MODULE_ID, "separatorMode") || "blankLine";

        const featureIconAdversary = game.settings.get(MODULE_ID, "featureIconAdversary");
        const featureIconEnvironment = game.settings.get(MODULE_ID, "featureIconEnvironment");
        const featureIconFeature = game.settings.get(MODULE_ID, "featureIconFeature");
        const featureIconMatchAdversary = game.settings.get(MODULE_ID, "featureIconMatchAdversary");
        const featureIconMatchEnvironment = game.settings.get(MODULE_ID, "featureIconMatchEnvironment");

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
        // Save selected Feature compendiums
        const selectedFeatures = [];
        const featureChecks = form.querySelectorAll("input[name='featureCompendiums']:checked");
        featureChecks.forEach(cb => selectedFeatures.push(cb.value));
        await game.settings.set(MODULE_ID, "selectedCompendiums", selectedFeatures);

        // Save selected Actor compendiums
        const selectedActors = [];
        const actorChecks = form.querySelectorAll("input[name='actorCompendiums']:checked");
        actorChecks.forEach(cb => selectedActors.push(cb.value));
        await game.settings.set(MODULE_ID, "selectedActorCompendiums", selectedActors);

        // Save folder name settings
        const adversaryFolderInput = form.querySelector("input[name='adversaryFolderName']");
        const environmentFolderInput = form.querySelector("input[name='environmentFolderName']");
        const lootFolderInput = form.querySelector("input[name='lootFolderName']");
        const consumableFolderInput = form.querySelector("input[name='consumableFolderName']");
        const weaponFolderInput = form.querySelector("input[name='weaponFolderName']");
        const armorFolderInput = form.querySelector("input[name='armorFolderName']");
        const featureFolderInput = form.querySelector("input[name='featureFolderName']");
        const domainCardFolderInput = form.querySelector("input[name='domainCardFolderName']");
        const separatorModeInput = form.querySelector("select[name='separatorMode']");

        if (adversaryFolderInput?.value) await game.settings.set(MODULE_ID, "adversaryFolderName", adversaryFolderInput.value);
        if (environmentFolderInput?.value) await game.settings.set(MODULE_ID, "environmentFolderName", environmentFolderInput.value);
        if (lootFolderInput?.value) await game.settings.set(MODULE_ID, "lootFolderName", lootFolderInput.value);
        if (consumableFolderInput?.value) await game.settings.set(MODULE_ID, "consumableFolderName", consumableFolderInput.value);
        if (weaponFolderInput?.value) await game.settings.set(MODULE_ID, "weaponFolderName", weaponFolderInput.value);
        if (armorFolderInput?.value) await game.settings.set(MODULE_ID, "armorFolderName", armorFolderInput.value);
        if (featureFolderInput?.value) await game.settings.set(MODULE_ID, "featureFolderName", featureFolderInput.value);
        if (domainCardFolderInput?.value) await game.settings.set(MODULE_ID, "domainCardFolderName", domainCardFolderInput.value);
        if (separatorModeInput?.value) await game.settings.set(MODULE_ID, "separatorMode", separatorModeInput.value);

        const featureIconAdversaryInput = form.querySelector("input[name='featureIconAdversary']");
        const featureIconEnvironmentInput = form.querySelector("input[name='featureIconEnvironment']");
        const featureIconFeatureInput = form.querySelector("input[name='featureIconFeature']");
        const featureIconMatchAdversaryInput = form.querySelector("input[name='featureIconMatchAdversary']");
        const featureIconMatchEnvironmentInput = form.querySelector("input[name='featureIconMatchEnvironment']");

        const adversaryIconVal = featureIconAdversaryInput?.value?.trim();
        if (adversaryIconVal) await game.settings.set(MODULE_ID, "featureIconAdversary", adversaryIconVal);
        const environmentIconVal = featureIconEnvironmentInput?.value?.trim();
        if (environmentIconVal) await game.settings.set(MODULE_ID, "featureIconEnvironment", environmentIconVal);
        const featureIconVal = featureIconFeatureInput?.value?.trim();
        if (featureIconVal) await game.settings.set(MODULE_ID, "featureIconFeature", featureIconVal);

        await game.settings.set(MODULE_ID, "featureIconMatchAdversary", featureIconMatchAdversaryInput?.checked || false);
        await game.settings.set(MODULE_ID, "featureIconMatchEnvironment", featureIconMatchEnvironmentInput?.checked || false);

        await game.settings.set(MODULE_ID, "configInitialized", true);
    }
}
