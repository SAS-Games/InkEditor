const { METADATA_DEFINITIONS } = require("./metadataDefinitions.js");

const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

function warning(code, message, field) {
    return { severity: "warning", code: code, message: message, field: field || null };
}

function validateMetadata(context, configurationResult) {
    const messages = [];
    const configuration = configurationResult || { status: "missing", catalogs: {}, warnings: [] };

    (configuration.warnings || []).forEach(message => {
        messages.push(warning("configuration", message));
    });

    if( !context ) return messages;

    METADATA_DEFINITIONS.forEach(definition => {
        const key = definition.key;
        const occurrences = context.metadata.occurrences[key] || [];
        const value = context.metadata.values[key];

        if( occurrences.length > 1 ) {
            messages.push(warning(
                "duplicate-" + key,
                "Duplicate # " + key + " tags found; edits update the tag nearest the dialogue line.",
                key
            ));
        }

        if( occurrences.some(entry => entry.value.length === 0) ) {
            messages.push(warning("empty-" + key, "# " + key + " contains an empty value.", key));
        }

        if( (key === "id" || key === "locale") && value && !SAFE_IDENTIFIER_PATTERN.test(value) ) {
            messages.push(warning(
                "invalid-" + key,
                (key === "id" ? "Line ID" : "Localization key") + " must match " + SAFE_IDENTIFIER_PATTERN.toString() + ".",
                key
            ));
        }

        const catalog = configuration.catalogs && configuration.catalogs[key];
        if( value && Array.isArray(catalog) && catalog.length > 0 && !catalog.includes(value) ) {
            messages.push(warning(
                "catalog-" + key,
                "'" + value + "' is not present in the configured " + definition.label.toLowerCase() + " catalog.",
                key
            ));
        }
    });

    return messages;
}

exports.SAFE_IDENTIFIER_PATTERN = SAFE_IDENTIFIER_PATTERN;
exports.validateMetadata = validateMetadata;
