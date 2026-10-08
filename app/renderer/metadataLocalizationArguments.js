const LOCALIZATION_ARGUMENT_KEY = "loc-arg";
const LOCALIZATION_ARGUMENT_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
const LOCALIZATION_ARGUMENT_TYPES = Object.freeze(["int", "float", "bool", "string", "localized"]);
const LOCALIZATION_ARGUMENT_TYPE_LABELS = Object.freeze({
    int: "Integer",
    float: "Float",
    bool: "Boolean",
    string: "String",
    localized: "Localized String"
});

function parseLocalizationArgument(value) {
    const source = String(value == null ? "" : value);
    const firstComma = source.indexOf(",");
    const secondComma = firstComma < 0 ? -1 : source.indexOf(",", firstComma + 1);

    const argument = {
        name: firstComma < 0 ? source.trim() : source.substring(0, firstComma).trim(),
        type: secondComma < 0 ? "" : source.substring(firstComma + 1, secondComma).trim().toLowerCase(),
        value: "",
        table: "",
        entry: ""
    };

    if( secondComma < 0 ) return argument;

    const payload = source.substring(secondComma + 1);
    if( argument.type === "localized" ) {
        const payloadComma = payload.indexOf(",");
        argument.table = payloadComma < 0 ? payload.trim() : payload.substring(0, payloadComma).trim();
        argument.entry = payloadComma < 0 ? "" : payload.substring(payloadComma + 1).trim();
    } else {
        // String and Ink expression values may contain commas, so only the first
        // two separators are structural for non-localized arguments.
        argument.value = payload.trim();
    }

    return argument;
}

function serializeLocalizationArgument(argument) {
    const source = argument || {};
    const name = String(source.name || "").trim();
    const type = String(source.type || "").trim().toLowerCase();

    if( type === "localized" ) {
        return [name, type, String(source.table || "").trim(), String(source.entry || "").trim()].join(",");
    }

    return [name, type, String(source.value == null ? "" : source.value).trim()].join(",");
}

function validateLocalizationArgument(argument) {
    const source = argument || {};
    const name = String(source.name || "").trim();
    const type = String(source.type || "").trim().toLowerCase();

    if( !LOCALIZATION_ARGUMENT_NAME_PATTERN.test(name) ) {
        return "Argument name must start with a letter and contain only letters, numbers, '_' or '-'.";
    }
    if( !LOCALIZATION_ARGUMENT_TYPES.includes(type) ) {
        return "Choose a supported argument type.";
    }

    if( type === "localized" ) {
        const table = String(source.table || "").trim();
        const entry = String(source.entry || "").trim();
        if( !table || !entry ) return "Localized arguments require both a table and an entry key.";
        if( table.includes(",") || entry.includes(",") ) {
            return "Localized table and entry keys cannot contain commas.";
        }
        return null;
    }

    if( type !== "string" && String(source.value == null ? "" : source.value).trim().length === 0 ) {
        return "This argument type requires a value or Ink expression.";
    }

    return null;
}

exports.LOCALIZATION_ARGUMENT_KEY = LOCALIZATION_ARGUMENT_KEY;
exports.LOCALIZATION_ARGUMENT_NAME_PATTERN = LOCALIZATION_ARGUMENT_NAME_PATTERN;
exports.LOCALIZATION_ARGUMENT_TYPES = LOCALIZATION_ARGUMENT_TYPES;
exports.LOCALIZATION_ARGUMENT_TYPE_LABELS = LOCALIZATION_ARGUMENT_TYPE_LABELS;
exports.parseLocalizationArgument = parseLocalizationArgument;
exports.serializeLocalizationArgument = serializeLocalizationArgument;
exports.validateLocalizationArgument = validateLocalizationArgument;
