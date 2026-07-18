const fs = require("fs");
const path = require("path");

const { METADATA_KEYS } = require("./metadataDefinitions.js");

function metadataPathForMainInk(mainInkPath) {
    if( !mainInkPath ) return null;

    const resolvedPath = path.resolve(mainInkPath);
    const extension = path.extname(resolvedPath);
    const basePath = extension.toLowerCase() === ".ink"
        ? resolvedPath.substring(0, resolvedPath.length - extension.length)
        : resolvedPath;

    return basePath + ".metadata.json";
}

function result(status, configPath, catalogs, warnings, configuration) {
    return {
        status: status,
        path: configPath,
        catalogs: catalogs || {},
        warnings: warnings || [],
        configuration: configuration || null
    };
}

function loadMetadataConfiguration(mainInkPath) {
    const configPath = metadataPathForMainInk(mainInkPath);
    if( !configPath ) {
        return result("missing", null, {}, ["Save the main Ink story to associate a metadata configuration file."]);
    }

    if( !fs.existsSync(configPath) ) {
        return result("missing", configPath, {}, ["Metadata configuration not found; editable free-text fields remain available."]);
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
    let status = "loaded";
    if( configuration.schemaVersion !== 1 ) {
        status = "invalid";
        warnings.push("Unsupported metadata schemaVersion; expected schemaVersion 1.");
    }

    const tags = configuration.tags;
    if( tags != null && (Array.isArray(tags) || typeof tags !== "object") ) {
        return result("malformed", configPath, {}, ["Metadata configuration 'tags' must be a JSON object."], configuration);
    }

    const catalogs = {};
    METADATA_KEYS.forEach(key => {
        if( !tags || tags[key] == null ) return;

        const tagDefinition = tags[key];
        if( !tagDefinition || Array.isArray(tagDefinition) || typeof tagDefinition !== "object" ) {
            warnings.push("Metadata configuration for '" + key + "' must be an object.");
            return;
        }

        if( !Array.isArray(tagDefinition.values) ) {
            warnings.push("Metadata configuration values for '" + key + "' must be an array.");
            return;
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

        catalogs[key] = values;
    });

    return result(status, configPath, catalogs, warnings, configuration);
}

exports.metadataPathForMainInk = metadataPathForMainInk;
exports.loadMetadataConfiguration = loadMetadataConfiguration;
