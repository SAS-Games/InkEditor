const METADATA_DEFINITIONS = Object.freeze([
    Object.freeze({ key: "id", label: "Line ID", catalog: false }),
    Object.freeze({ key: "locale", label: "Localization Key", catalog: false }),
    Object.freeze({ key: "speaker", label: "Speaker", catalog: true }),
    Object.freeze({ key: "portrait", label: "Portrait", catalog: true }),
    Object.freeze({ key: "animation", label: "Animation", catalog: true }),
    Object.freeze({ key: "audio", label: "Audio", catalog: true })
]);

const METADATA_KEYS = Object.freeze(METADATA_DEFINITIONS.map(definition => definition.key));
const METADATA_KEY_SET = new Set(METADATA_KEYS);

function canonicalMetadataKey(key) {
    if( typeof key !== "string" ) return null;

    const canonicalKey = key.trim().toLowerCase();
    return METADATA_KEY_SET.has(canonicalKey) ? canonicalKey : null;
}

exports.METADATA_DEFINITIONS = METADATA_DEFINITIONS;
exports.METADATA_KEYS = METADATA_KEYS;
exports.canonicalMetadataKey = canonicalMetadataKey;
