const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Dialog for displaying generated feature code for weapons/armors
 */
export class FeatureCodeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "dh-feature-code-dialog",
        tag: "div",
        window: {
            title: "Feature Code Generator",
            icon: "fas fa-code",
            minimizable: false,
            resizable: true
        },
        position: {
            width: 700,
            height: 450
        },
        actions: {
            copy: FeatureCodeDialog._onCopy
        }
    };

    static PARTS = {
        form: {
            template: "modules/dh-statblock-importer/templates/code-dialog.hbs"
        }
    };

    constructor(options = {}) {
        super(options);
        this.features = options.features || [];
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.code = FeatureCodeDialog.generateFeatureCode(this.features);
        context.featureCount = this.features.length;
        return context;
    }

    /**
     * Converts a string to lowerCamelCase
     * Example: "Heavy Caliber" -> "heavyCaliber"
     * @param {string} str - Input string
     * @returns {string} - lowerCamelCase string
     */
    static toLowerCamelCase(str) {
        return str
            .trim()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .split(/\s+/)
            .map((word, i) => i === 0
                ? word.toLowerCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join('');
    }

    /**
     * Generates CONFIG.DH.ITEM code for features
     * @param {Array} features - Array of {mode, label, description}
     * @returns {string} - Formatted code
     */
    static generateFeatureCode(features) {
        if (!features || features.length === 0) return '';

        // Deduplicate by normalized label
        const uniqueMap = new Map();
        features.forEach(f => {
            const key = f.label.toLowerCase().trim();
            if (!uniqueMap.has(key)) uniqueMap.set(key, f);
        });

        const uniqueFeatures = Array.from(uniqueMap.values());

        // Header comment
        let code = `/*
 * Daggerheart Feature Code Generator
 * Copy this code into your module
 * Reload Foundry after it
 * Features will be available in weapon/armor dropdowns
 */

Hooks.on('init', () => {
`;

        // Generate each feature
        uniqueFeatures.forEach((feature, index) => {
            const key = FeatureCodeDialog.toLowerCamelCase(feature.label);
            const configPath = feature.mode === 'weapon'
                ? 'CONFIG.DH.ITEM.weaponFeatures'
                : 'CONFIG.DH.ITEM.armorFeatures';

            // Escape single quotes in description
            const escapedDesc = feature.description.replace(/'/g, "\\'");

            code += `  // ${feature.label}\n`;
            code += `  ${configPath}.${key} = {\n`;
            code += `    label: '${feature.label}',\n`;
            code += `    description: '${escapedDesc}',\n`;
            code += `    actions: [],\n`;
            code += `    effects: []\n`;
            code += `  };\n`;

            // Add blank line between features (except last)
            if (index < uniqueFeatures.length - 1) code += '\n';
        });

        code += '});';

        return code;
    }

    /**
     * Copy button action handler
     */
    static async _onCopy(event, target) {
        const textarea = this.element.querySelector('textarea');
        const code = textarea.value;

        try {
            await navigator.clipboard.writeText(code);

            // Visual feedback
            const button = target;
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i> Copied!';
            button.classList.add('success');

            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('success');
            }, 2000);

            ui.notifications.info("Code copied to clipboard!");
        } catch (err) {
            ui.notifications.error("Failed to copy to clipboard");
            console.error("Daggerheart: Statblock Importer | Copy failed:", err);
        }
    }
}
