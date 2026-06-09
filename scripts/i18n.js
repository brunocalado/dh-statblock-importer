import { MODULE_ID } from "./constants.js";

export { MODULE_ID };
export const MODULE_KEY = "DH_STATBLOCK_IMPORTER";

export function moduleKey(path) {
  return `${MODULE_KEY}.${path}`;
}

export function localize(path) {
  return game.i18n.localize(moduleKey(path));
}

export function format(path, data = {}) {
  return game.i18n.format(moduleKey(path), data);
}

export function localizeKey(key, fallback = key) {
  const value = game.i18n.localize(key);
  return value === key ? fallback : value;
}

export function localizeSettingValue(value, fallbackPath) {
  const fallback = fallbackPath ? localize(fallbackPath) : value;

  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }

  if (value.startsWith(`${MODULE_KEY}.`)) {
    return localizeKey(value, fallback);
  }

  return value;
}

export function titleCase(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

export function actorTypeLabel(type) {
  return localizeKey(`TYPES.Actor.${type}`, titleCase(type));
}

export function itemTypeLabel(type) {
  return localizeKey(`TYPES.Item.${type}`, titleCase(type));
}

export function adversaryTypeLabel(type) {
  return localizeKey(`DAGGERHEART.CONFIG.AdversaryType.${type}.label`, titleCase(type));
}

export function environmentTypeLabel(type) {
  return localizeKey(`DAGGERHEART.CONFIG.EnvironmentType.${type}.label`, titleCase(type));
}

export function featureFormLabel(form) {
  return localizeKey(`DAGGERHEART.CONFIG.FeatureForm.${form}`, titleCase(form));
}

export function rangeLabel(range) {
  return localizeKey(`DAGGERHEART.CONFIG.Range.${range}.name`, titleCase(range));
}
