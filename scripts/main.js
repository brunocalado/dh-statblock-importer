import { StatblockImporter } from "./app.js";

/**
 * Global API object for the module.
 */
const SI = {
  /**
   * Opens the Statblock Importer window.
   */
  Open: () => {
    new StatblockImporter().render(true);
  }
};

/* -------------------------------------------- */
/* Hooks                                       */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log("Daggerheart: Statblock Importer | Initializing...");

  // Registrar configurações imediatamente ao iniciar
  StatblockImporter.registerSettings();

  // Expose SI to global window object
  window.SI = SI;
});

Hooks.once("ready", () => {
  console.log("Daggerheart: Statblock Importer | Ready.");
});