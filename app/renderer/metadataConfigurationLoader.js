const fs = require("fs");
const path = require("path");

const {
    METADATA_DEFINITIONS,
    METADATA_CONTEXTS,
    isValidMetadataKey,
    normalizeMetadataKey,
    labelFromMetadataKey
} = require("./metadataDefinitions.js");

function metadataPathForMainInk(mainInkPath) {
    if( !mainInkPath ) return null;

    const resolvedPath = path.resolve(mainInkPath);
    const extension = path.extname(resolvedPath);
    const basePath = extension.toLowerCase() === ".ink"
        ? resolvedPath.substring(0, resolvedPath.length - extension.length)
        : resolvedPath;

    return basePath + ".metadata.json";
}

function copyBuiltInDefinitions() {
    return METADATA_DEFINITIONS.map(definition => ({
        key: definition.key,
        label: definition.label,
        catalog: definition.catalog,
        contexts: definition.contexts.slice(),
        options: Array.isArray(definition.options) ? definition.options.slice() : null,
        optionLabels: definition.optionLabels ? Object.assign({}, definition.optionLabels) : null,
        repeatable: Boolean(definition.repeatable),
        specialized: definition.specialized || null
    }));
}

function result(status, configPath, catalogs, warnings, configuration, definitions) {
    return {
        status: status,
        path: configPath,
        catalogs: catalogs || {},
        warnings: warnings || [],
        configuration: configuration || null,
        definitions: definitions || copyBuiltInDefinitions()
    };
}

function parseContexts(tagDefinition, fallbackContexts, key, warnings) {
    if( tagDefinition.contexts == null ) return fallbackContexts.slice();
    if( !Array.isArray(tagDefinition.contexts) ) {
        warnings.push("Metadata contexts for '" + key + "' must be an array containing 'dialogue', 'choice', or both.");
        return fallbackContexts.slice();
    }

    const contexts = [];
    tagDefinition.contexts.forEach(context => {
        if( typeof context !== "string" || !METADATA_CONTEXTS.includes(context.toLowerCase()) ) {
            warnings.push("Ignored unsupported metadata context for '" + key + "'.");
            return;
        }

        const canonicalContext = context.toLowerCase();
        if( !contexts.includes(canonicalContext) ) contexts.push(canonicalContext);
    });

    if( contexts.length === 0 ) {
        warnings.push("Metadata contexts for '" + key + "' cannot be empty; using the default contexts.");
        return fallbackContexts.slice();
    }

    return contexts;
}

function parseCatalog(tagDefinition, key, warnings, required) {
    if( tagDefinition.values == null && !required ) return null;
    if( !Array.isArray(tagDefinition.values) ) {
        warnings.push("Metadata configuration values for '" + key + "' must be an array.");
        return null;
    }

    const values = [];
    tagDefinition.values.forEach(value => {
        if( typeof value !== "string" || value.trim().length === 0 ) {
            warnings.push("Ignored an empty or non-string catalog value for '" + key + "'.");
            return;
        }

        const normalizedValue = value.trim();
        if( !values.includes(normalizedValue) ) values.push(normalizedValue);
    });

    return values;
}

function buildConfiguration(configuration, warnings) {
    const definitions = copyBuiltInDefinitions();
    const definitionsByKey = new Map(definitions.map(definition => [definition.key, definition]));
    const catalogs = {};
    const seenKeys = new Set();
    const tags = configuration.tags || {};

    Object.keys(tags).forEach(configuredKey => {
        const canonicalKey = normalizeMetadataKey(configuredKey);
        if( !isValidMetadataKey(configuredKey) ) {
            warnings.push("Ignored invalid metadata tag key '" + configuredKey + "'.");
            return;
        }
        if( seenKeys.has(canonicalKey) ) {
            warnings.push("Ignored duplicate metadata tag definition '" + configuredKey + "'.");
            return;
        }
        seenKeys.add(canonicalKey);

        const tagDefinition = tags[configuredKey];
        if( !tagDefinition || Array.isArray(tagDefinition) || typeof tagDefinition !== "object" ) {
            warnings.push("Metadata configuration for '" + canonicalKey + "' must be an object.");
            return;
        }

        let definition = definitionsByKey.get(canonicalKey);
        if( !definition ) {
            if( configuration.schemaVersion !== 2 ) {
                warnings.push("Ignored custom metadata tag '" + canonicalKey + "'; custom fields require schemaVersion 2.");
                return;
            }

            definition = {
                key: canonicalKey,
                label: labelFromMetadataKey(canonicalKey),
                catalog: false,
                contexts: METADATA_CONTEXTS.slice()
            };
            definitions.push(definition);
            definitionsByKey.set(canonicalKey, definition);
        }

        if( configuration.schemaVersion === 2 ) {
            if( tagDefinition.label != null ) {
                if( typeof tagDefinition.label === "string" && tagDefinition.label.trim().length > 0 ) {
                    definition.label = tagDefinition.label.trim().substring(0, 80);
                } else {
                    warnings.push("Metadata label for '" + canonicalKey + "' must be a non-empty string.");
                }
            }
            definition.contexts = parseContexts(tagDefinition, definition.contexts, canonicalKey, warnings);
        }

        const values = parseCatalog(tagDefinition, canonicalKey, warnings, configuration.schemaVersion === 1);
        if( values ) {
            catalogs[canonicalKey] = values;
            definition.catalog = true;
        }
    });

    return { definitions: definitions, catalogs: catalogs };
}

function loadMetadataConfiguration(mainInkPath) {
    const configPath = metadataPathForMainInk(mainInkPath);
    if( !configPath ) {
        return result("missing", null, {}, ["Save the main Ink story to associate a metadata configuration file."]);
    }

    if( !fs.existsSync(configPath) ) {
        return result("missing", configPath, {}, ["Metadata configuration not found; built-in free-text fields remain available."]);
    }

    let fileContent;
    try {
        fileContent = fs.readFileSync(configPath, "utf8");
    } catch(error) {
        return result("malformed", configPath, {}, ["Could not read metadata configuration: " + error.message]);
    }

    let configuration;
    try {
        configuration = JSON.parse(fileContent);
    } catch(error) {
        return result("malformed", configPath, {}, ["Metadata configuration contains invalid JSON: " + error.message]);
    }

    if( !configuration || Array.isArray(configuration) || typeof configuration !== "object" ) {
        return result("malformed", configPath, {}, ["Metadata configuration must contain a JSON object."]);
    }

    const warnings = [];
    if( configuration.schemaVersion !== 1 && configuration.schemaVersion !== 2 ) {
        warnings.push("Unsupported metadata schemaVersion; expected schemaVersion 1 or 2.");
        return result("invalid", configPath, {}, warnings, configuration);
    }

    const tags = configuration.tags;
    if( tags != null && (Array.isArray(tags) || typeof tags !== "object") ) {
        return result("malformed", configPath, {}, ["Metadata configuration 'tags' must be a JSON object."], configuration);
    }

    const builtConfiguration = buildConfiguration(configuration, warnings);
    return result(
        "loaded",
        configPath,
        builtConfiguration.catalogs,
        warnings,
        configuration,
        builtConfiguration.definitions
    );
}

exports.metadataPathForMainInk = metadataPathForMainInk;
exports.loadMetadataConfiguration = loadMetadataConfiguration;
