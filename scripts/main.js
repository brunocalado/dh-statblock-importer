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
  StatblockImporter.registerSettings();
  window.SI = SI;
});

Hooks.on("renderActorDirectory", (app, html) => {
  const element = (html instanceof HTMLElement) ? html : html[0];
  const actionButtons = element.querySelector(".header-actions");

  if (actionButtons) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("create-actor");
    btn.style.flex = "0 0 100%";
    btn.style.maxWidth = "100%";
    btn.style.marginTop = "6px";
    btn.innerHTML = `<i class="fas fa-file-import"></i> Statblock Importer`;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      SI.Open();
    });

    actionButtons.appendChild(btn);
  }
});

Hooks.on("renderDaggerheartMenu", (app, html) => {
  const element = (html instanceof HTMLElement) ? html : html[0];

  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.width = "100%";
  btn.innerHTML = `<i class="fas fa-file-import"></i> Open Statblock Importer`;
  btn.onclick = (e) => {
    e.preventDefault();
    SI.Open();
  };

  const fieldset = element.querySelector("fieldset");
  if (fieldset) {
    const newFieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.innerText = "Statblock Importer";
    newFieldset.appendChild(legend);
    newFieldset.appendChild(btn);
    fieldset.after(newFieldset);
  } else {
    element.appendChild(btn);
  }
});