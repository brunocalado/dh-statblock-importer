/*!
 * Daggerheart: Stats Toolbox
 * 2025 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Rebuilds the "all-features" compendium source (packs/_source/all-features) from the adversaries shipped by
 * the Daggerheart system. The importer's statblock parser looks features up in this pack by
 * name, so it has to follow the system's data after every release.
 *
 * Ported from daggerheart-advmanager's tools/build-features.mjs, whose in-world importer
 * (AM.ImportFeatures) produced this pack originally. This module has no such importer, so its
 * rules live here: the "Core Features / <Type> / <Action|Reaction|Passive>" folder tree with the
 * same colours, one feature per name + item type + folder + tier unless it is in
 * ALWAYS_DUPLICATE, and the same `flags.importedFrom` block.
 *
 * Ids are derived from the source adversary and item ids rather than random, so rebuilding
 * against an unchanged system produces an unchanged pack.
 *
 * Getting the input (the running server holds a LOCK, so copy first):
 *
 *   cp -r <foundry-data>/systems/daggerheart/packs/adversaries /tmp/dh && rm -f /tmp/dh/adversaries/LOCK
 *   fvtt package unpack adversaries --inputDirectory /tmp/dh --outputDirectory /tmp/dh-unpacked \
 *     --type System --id daggerheart
 *
 * Then:
 *
 *   node tools/build-features.mjs /tmp/dh-unpacked            # print a summary
 *   node tools/build-features.mjs /tmp/dh-unpacked --write    # rewrite packs/_source/all-features
 *   npm run pack                                              # compile the LevelDB to test locally
 *
 * `npm run pack` needs no Foundry with this module's packs open: a LevelDB opens in one process
 * at a time. The release workflow compiles the packs from the JSON source on its own.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK_NAME = "all-features";
const SOURCE_COMPENDIUM = "daggerheart.adversaries";
const ROOT_FOLDER = "Core Features";
const CUSTOM_TAG = "Core Rulebook";

// Features kept once per adversary even when an identical name already sits in the same folder,
// because their text differs between the adversaries that share the name.
const ALWAYS_DUPLICATE = [
    "Scapegoat",
    "From Above",
    "Mind Dance",
    "Hallucinatory Breath",
    "Doombringer",
    "Death Quake",
    "Trample"
];

// Same palette as StatblockImporter.TYPE_COLORS, which colours the imported actors' folders.
const TYPE_COLORS = {
    "Bruiser": "#4a0404",
    "Horde": "#0f3d0f",
    "Leader": "#5c4905",
    "Minion": "#2f3f4f",
    "Ranged": "#002366",
    "Skulk": "#1a0033",
    "Social": "#660033",
    "Solo": "#000000",
    "Standard": "#3b1e08",
    "Support": "#004d40",
    "Unknown": "#333333"
};

// --- Input ---

/**
 * Reads every adversary Actor from one or more directories of unpacked pack JSON.
 * @param {string[]} dirs - Directories written by `fvtt package unpack`.
 * @returns {Object[]} Adversary source objects, sorted so a rebuild is deterministic.
 */
function loadAdversaries(dirs) {
    const out = [];
    for (const dir of dirs) {
        for (const file of fs.readdirSync(dir)) {
            if (!file.endsWith(".json")) continue;
            const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
            if (doc?.type === "adversary") out.push(doc);
        }
    }
    // The first copy of a duplicated feature is the one kept, so the order decides which
    // adversary a shared feature is credited to — pin it instead of trusting readdir.
    return out.sort((a, b) => a.name.localeCompare(b.name) || a._id.localeCompare(b._id));
}

/**
 * A stable 16-character Foundry id derived from the given parts.
 * @param {...string} parts - Anything that uniquely identifies the document.
 * @returns {string}
 */
function stableId(...parts) {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const bytes = crypto.createHash("sha256").update(parts.join("|")).digest();
    return Array.from(bytes.subarray(0, 16), b => chars[b % chars.length]).join("");
}

function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * The folder a feature is filed under, from its featureForm.
 * @param {Object} item - Item source data.
 * @returns {"Action"|"Reaction"|"Passive"}
 */
function getFeatureCategory(item) {
    const form = String(item.system?.featureForm || "").toLowerCase().trim();
    if (form.includes("reaction")) return "Reaction";
    if (form.includes("action")) return "Action";
    return "Passive";
}

// --- Build ---

/**
 * Turns the adversaries into the folder and item documents of the compendium.
 * @param {Object[]} adversaries - Adversary source objects.
 * @param {string|null} systemVersion - Version stamped into each document's _stats.
 * @returns {{folders: Object[], items: Object[], skipped: number}}
 */
function buildFeatures(adversaries, systemVersion) {
    const stats = { systemId: "daggerheart", systemVersion };
    const folders = new Map();

    const folder = (name, parent, color, sort) => {
        const key = `${parent?._id ?? ""}/${name}`;
        if (!folders.has(key)) {
            const _id = stableId("folder", key);
            folders.set(key, {
                _id, name, type: "Item", color, sorting: "a", sort, description: "",
                folder: parent?._id ?? null, flags: {}, _stats: stats, _key: `!folders!${_id}`
            });
        }
        return folders.get(key);
    };

    const root = folder(ROOT_FOLDER, null, "#000000", 100000);
    const items = [];
    const seen = new Set();
    let skipped = 0;

    for (const adversary of adversaries) {
        const advType = capitalize(adversary.system?.type || "Standard");
        const tier = Number(adversary.system?.tier) || 0;
        const typeFolder = folder(advType, root, TYPE_COLORS[advType] || TYPE_COLORS.Unknown, 0);

        for (const item of adversary.items ?? []) {
            const categoryFolder = folder(getFeatureCategory(item), typeFolder, null, 0);
            const isSpecialCase = ALWAYS_DUPLICATE.includes(item.name);
            // The description is part of the key: adversaries of the same type and tier share feature
            // names whose text differs (a Minion (3) naming "the Crawler", a Group Attack dealing 2
            // damage instead of 1), and the importer picks between them by text.
            const dedupKey = `${item.name}|${item.type}|${categoryFolder._id}|${tier}|${item.system?.description ?? ""}`;
            if (!isSpecialCase && seen.has(dedupKey)) {
                skipped++;
                continue;
            }
            seen.add(dedupKey);

            const _id = stableId("item", adversary._id, item._id);
            items.push({
                _id,
                name: item.name,
                type: item.type,
                img: item.img || "icons/svg/item-bag.svg",
                system: item.system,
                effects: (item.effects ?? []).map(effect => ({ ...effect, _key: `!items.effects!${_id}.${effect._id}` })),
                folder: categoryFolder._id,
                sort: 0,
                ownership: { default: 0 },
                flags: {
                    importedFrom: {
                        compendium: SOURCE_COMPENDIUM,
                        adversary: adversary.name,
                        tier,
                        type: advType,
                        customTag: CUSTOM_TAG,
                        originalId: item._id,
                        isSpecialCase
                    }
                },
                _stats: stats,
                _key: `!items!${_id}`
            });
        }
    }

    return { folders: [...folders.values()], items, skipped };
}

/**
 * Prints what the pack will contain, per adversary type.
 * @param {Object[]} items - Built item documents.
 */
function report(items) {
    const byType = new Map();
    for (const item of items) {
        const { type, tier } = item.flags.importedFrom;
        byType.set(type, byType.get(type) ?? { total: 0, tiers: {} });
        const row = byType.get(type);
        row.total++;
        row.tiers[tier] = (row.tiers[tier] ?? 0) + 1;
    }
    for (const [type, row] of [...byType].sort()) {
        const tiers = [1, 2, 3, 4].map(t => `T${t} ${row.tiers[t] ?? 0}`).join("  ");
        console.log(`  ${type.padEnd(9)} ${String(row.total).padStart(4)}   ${tiers}`);
    }
}

// --- Main ---

const args = process.argv.slice(2);
const write = args.includes("--write");
const dirs = args.filter(a => !a.startsWith("--"));

if (!dirs.length) {
    console.error("usage: node tools/build-features.mjs <unpacked-adversary-dir>... [--write]");
    process.exit(2);
}

const adversaries = loadAdversaries(dirs);
const versions = new Set(adversaries.map(a => a._stats?.systemVersion).filter(Boolean));
const systemVersion = versions.size === 1 ? [...versions][0] : null;
if (versions.size > 1) console.warn(`Warning: adversaries come from several system versions: ${[...versions].join(", ")}`);

const { folders, items, skipped } = buildFeatures(adversaries, systemVersion);
console.log(`Read ${adversaries.length} adversaries (system ${systemVersion ?? "unknown"}).`);
console.log(`${items.length} features in ${folders.length} folders; ${skipped} duplicates skipped.\n`);
report(items);

if (write) {
    // Replace the folder wholesale so a feature dropped by the system disappears from the pack.
    const sourceDir = path.join(ROOT, "packs", "_source", PACK_NAME);
    fs.rmSync(sourceDir, { recursive: true, force: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    for (const doc of [...folders, ...items]) {
        // Same filename and serialization as the CLI's extractPack, so `npm run unpack` after
        // `npm run pack` leaves these files untouched.
        const file = `${doc.name.replace(/[^a-zA-Z0-9А-я]/g, "_")}_${doc._id}.json`;
        fs.writeFileSync(path.join(sourceDir, file), JSON.stringify(doc, null, 2) + "\n");
    }
    console.log(`\nWrote packs/_source/${PACK_NAME} (${items.length} features, ${folders.length} folders). Run \`npm run pack\` to rebuild the LevelDB.`);
} else {
    console.log(`\n(dry run — pass --write to rewrite packs/_source/${PACK_NAME})`);
}
