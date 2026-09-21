const METADATA_DEFINITIONS = Object.freeze([
    Object.freeze({ key: "id", label: "ID", catalog: false, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "locale", label: "Localization Key", catalog: false, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "speaker", label: "Speaker", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "portrait", label: "Portrait", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "animation", label: "Animation", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "audio", label: "Audio", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "skip", label: "Story Skip", catalog: false, contexts: Object.freeze(["dialogue"]) })
]);

const METADATA_KEYS = Object.freeze(METADATA_DEFINITIONS.map(definition => definition.key));
const METADATA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const METADATA_CONTEXTS = Object.freeze(["dialogue", "choice"]);
const UNSAFE_METADATA_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function normalizeMetadataKey(key) {
    return typeof key === "string" ? key.trim().toLowerCase() : null;
}

function isValidMetadataKey(key) {
    const canonicalKey = normalizeMetadataKey(key);
    return canonicalKey != null && METADATA_KEY_PATTERN.test(key) && !UNSAFE_METADATA_KEYS.has(canonicalKey);
}

function labelFromMetadataKey(key) {
    const words = String(key || "").replace(/[_.-]+/g, " ").trim();
    return words.length ? words[0].toUpperCase() + words.substring(1) : String(key || "");
}

function canonicalMetadataKey(key, definitions) {
    if( typeof key !== "string" ) return null;

    const canonicalKey = normalizeMetadataKey(key);
    const availableDefinitions = Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
    return availableDefinitions.some(definition => definition.key === canonicalKey) ? canonicalKey : null;
}

function definitionsForContext(definitions, contextType) {
    const availableDefinitions = Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
    return availableDefinitions.filter(definition => {
        return !Array.isArray(definition.contexts) || definition.contexts.includes(contextType);
    });
}

function discoverMetadataDefinitions(entries, configuredDefinitions, contextType) {
    const definitions = Array.isArray(configuredDefinitions) ? configuredDefinitions : METADATA_DEFINITIONS;
    const knownKeys = new Set(definitions.map(definition => definition.key));
    const discoveredDefinitions = [];

    (entries || []).forEach(entry => {
        if( !entry || !entry.key || !isValidMetadataKey(entry.key) ) return;

        const key = normalizeMetadataKey(entry.key);
        if( knownKeys.has(key) ) return;

        knownKeys.add(key);
        discoveredDefinitions.push({
            key: key,
            label: labelFromMetadataKey(key),
            catalog: false,
            contexts: [contextType],
            discovered: true
        });
    });

    return discoveredDefinitions;
}

exports.METADATA_DEFINITIONS = METADATA_DEFINITIONS;
exports.METADATA_KEYS = METADATA_KEYS;
exports.METADATA_KEY_PATTERN = METADATA_KEY_PATTERN;
exports.METADATA_CONTEXTS = METADATA_CONTEXTS;
exports.normalizeMetadataKey = normalizeMetadataKey;
exports.isValidMetadataKey = isValidMetadataKey;
exports.labelFromMetadataKey = labelFromMetadataKey;
exports.canonicalMetadataKey = canonicalMetadataKey;
exports.definitionsForContext = definitionsForContext;
exports.discoverMetadataDefinitions = discoverMetadataDefinitions;
