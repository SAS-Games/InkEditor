const METADATA_DEFINITIONS = Object.freeze([
    Object.freeze({ key: "id", label: "ID", catalog: false, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "locale", label: "Localization Key", catalog: false, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "speaker", label: "Speaker", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "portrait", label: "Portrait", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "animation", label: "Animation", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) }),
    Object.freeze({ key: "audio", label: "Audio", catalog: true, contexts: Object.freeze(["dialogue", "choice"]) })
]);

const METADATA_KEYS = Object.freeze(METADATA_DEFINITIONS.map(definition => definition.key));
const METADATA_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.-]*$/;
const METADATA_CONTEXTS = Object.freeze(["dialogue", "choice"]);

function canonicalMetadataKey(key, definitions) {
    if( typeof key !== "string" ) return null;

    const canonicalKey = key.trim().toLowerCase();
    const availableDefinitions = Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
    return availableDefinitions.some(definition => definition.key === canonicalKey) ? canonicalKey : null;
}

function definitionsForContext(definitions, contextType) {
    const availableDefinitions = Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
    return availableDefinitions.filter(definition => {
        return !Array.isArray(definition.contexts) || definition.contexts.includes(contextType);
    });
}

exports.METADATA_DEFINITIONS = METADATA_DEFINITIONS;
exports.METADATA_KEYS = METADATA_KEYS;
exports.METADATA_KEY_PATTERN = METADATA_KEY_PATTERN;
exports.METADATA_CONTEXTS = METADATA_CONTEXTS;
exports.canonicalMetadataKey = canonicalMetadataKey;
exports.definitionsForContext = definitionsForContext;
