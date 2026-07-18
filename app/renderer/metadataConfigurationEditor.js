const fs = require("fs");

const {
    METADATA_CONTEXTS,
    isValidMetadataKey,
    normalizeMetadataKey
} = require("./metadataDefinitions.js");

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function configuredTag(configurationResult, key) {
    const configuration = configurationResult && configurationResult.configuration;
    const tags = configuration && configuration.tags;
    const canonicalKey = normalizeMetadataKey(key);
    if( !tags || Array.isArray(tags) || typeof tags !== "object" || !canonicalKey ) return null;

    const rawKey = Object.keys(tags).find(candidate => normalizeMetadataKey(candidate) === canonicalKey);
    if( !rawKey ) return null;

    return { key: rawKey, definition: tags[rawKey] };
}

function canEditMetadataConfiguration(configurationResult) {
    if( !configurationResult || !configurationResult.path ) return false;
    return configurationResult.status !== "malformed";
}

function readLatestConfiguration(configurationResult) {
    if( !canEditMetadataConfiguration(configurationResult) ) {
        if( configurationResult && configurationResult.status === "malformed" ) {
            throw new Error("Fix the malformed metadata JSON before editing it here.");
        }
        throw new Error("Save the main Ink story before configuring metadata.");
    }

    if( !fs.existsSync(configurationResult.path) ) return {};

    let configuration;
    try {
        configuration = JSON.parse(fs.readFileSync(configurationResult.path, "utf8"));
    } catch(error) {
        throw new Error("The metadata configuration changed and is not valid JSON. Fix it before saving from Inky.");
    }

    if( !configuration || Array.isArray(configuration) || typeof configuration !== "object" ) {
        throw new Error("The metadata configuration must contain a JSON object.");
    }
    if( configuration.tags != null && (Array.isArray(configuration.tags) || typeof configuration.tags !== "object") ) {
        throw new Error("The metadata configuration 'tags' property must be a JSON object.");
    }

    return cloneJson(configuration);
}

function normalizedContexts(contexts) {
    const result = [];
    (Array.isArray(contexts) ? contexts : []).forEach(context => {
        const canonicalContext = typeof context === "string" ? context.trim().toLowerCase() : "";
        if( METADATA_CONTEXTS.includes(canonicalContext) && !result.includes(canonicalContext) ) {
            result.push(canonicalContext);
        }
    });

    if( result.length === 0 ) {
        throw new Error("Choose Dialogue, Choice, or both for this field.");
    }
    return result;
}

function normalizedValues(values) {
    const result = [];
    (Array.isArray(values) ? values : []).forEach(value => {
        if( typeof value !== "string" ) return;
        const normalizedValue = value.trim();
        if( normalizedValue && !result.includes(normalizedValue) ) result.push(normalizedValue);
    });
    return result;
}

function canonicalFieldKey(key) {
    if( !isValidMetadataKey(key) ) {
        throw new Error("Field keys must start with a letter and use only letters, numbers, dots, hyphens, or underscores.");
    }
    return normalizeMetadataKey(key);
}

function writeConfiguration(configurationResult, configuration) {
    fs.writeFileSync(configurationResult.path, JSON.stringify(configuration, null, 2) + "\n", "utf8");
    return configuration;
}

function saveMetadataField(configurationResult, field) {
    const canonicalKey = canonicalFieldKey(field && field.key);
    const contexts = normalizedContexts(field && field.contexts);
    const values = normalizedValues(field && field.values);
    const label = field && typeof field.label === "string" ? field.label.trim() : "";
    if( label.length > 80 ) throw new Error("Field labels must be 80 characters or fewer.");

    const configuration = readLatestConfiguration(configurationResult);
    const tags = configuration.tags && !Array.isArray(configuration.tags) && typeof configuration.tags === "object"
        ? configuration.tags
        : {};
    const existingKeys = Object.keys(tags).filter(key => normalizeMetadataKey(key) === canonicalKey);
    let definition = {};
    if( existingKeys.length > 0 ) {
        const currentDefinition = tags[existingKeys[existingKeys.length - 1]];
        if( currentDefinition && !Array.isArray(currentDefinition) && typeof currentDefinition === "object" ) {
            definition = cloneJson(currentDefinition);
        }
    }

    existingKeys.forEach(key => delete tags[key]);
    if( label ) definition.label = label;
    else delete definition.label;
    definition.contexts = contexts;
    if( values.length > 0 ) definition.values = values;
    else delete definition.values;

    tags[canonicalKey] = definition;
    configuration.schemaVersion = 2;
    configuration.tags = tags;
    return writeConfiguration(configurationResult, configuration);
}

function removeMetadataField(configurationResult, key) {
    const canonicalKey = canonicalFieldKey(key);
    const configuration = readLatestConfiguration(configurationResult);
    const tags = configuration.tags;
    if( !tags ) return configuration;

    Object.keys(tags).forEach(configuredKey => {
        if( normalizeMetadataKey(configuredKey) === canonicalKey ) delete tags[configuredKey];
    });
    configuration.schemaVersion = 2;
    return writeConfiguration(configurationResult, configuration);
}

exports.configuredTag = configuredTag;
exports.canEditMetadataConfiguration = canEditMetadataConfiguration;
exports.saveMetadataField = saveMetadataField;
exports.removeMetadataField = removeMetadataField;
