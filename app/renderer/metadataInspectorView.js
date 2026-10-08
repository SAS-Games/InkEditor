const path = require("path");

const {
    METADATA_DEFINITIONS,
    normalizeMetadataKey
} = require("./metadataDefinitions.js");
const {
    configuredTag,
    canEditMetadataConfiguration
} = require("./metadataConfigurationEditor.js");
const {
    LOCALIZATION_ARGUMENT_KEY,
    LOCALIZATION_ARGUMENT_TYPES,
    LOCALIZATION_ARGUMENT_TYPE_LABELS,
    parseLocalizationArgument,
    validateLocalizationArgument
} = require("./metadataLocalizationArguments.js");

const BUILT_IN_KEYS = new Set(METADATA_DEFINITIONS.map(definition => definition.key));

function MetadataInspectorView(documentObject) {
    this.document = documentObject;
    this.root = documentObject.getElementById("metadata-inspector");
    this.main = documentObject.getElementById("main");
    this.fieldsContainer = this.root.querySelector(".metadata-fields");
    this.status = this.root.querySelector(".metadata-selection-status");
    this.lineNumber = this.root.querySelector(".metadata-line-number");
    this.contextType = this.root.querySelector(".metadata-context-type");
    this.configurationStatus = this.root.querySelector(".metadata-configuration-status");
    this.validationList = this.root.querySelector(".metadata-validation-list");
    this.removeAllButton = this.root.querySelector(".metadata-remove-all");
    this.collapseButton = this.root.querySelector(".metadata-collapse");
    this.tabButtons = Array.from(this.root.querySelectorAll("[data-metadata-tab]"));
    this.tabPanels = Array.from(this.root.querySelectorAll("[data-metadata-panel]"));
    this.configurationEditorStatus = this.root.querySelector(".metadata-configuration-editor-status");
    this.configurationField = this.root.querySelector(".metadata-configuration-field");
    this.configurationLabel = this.root.querySelector(".metadata-configuration-label-input");
    this.configurationContexts = Array.from(this.root.querySelectorAll(".metadata-configuration-contexts input"));
    this.configurationValues = this.root.querySelector(".metadata-configuration-values");
    this.configurationSave = this.root.querySelector(".metadata-configuration-save");
    this.configurationRemove = this.root.querySelector(".metadata-configuration-remove");
    this.customFieldForm = this.root.querySelector(".metadata-custom-field-form");
    this.customFieldKey = this.root.querySelector(".metadata-custom-field-key");
    this.customFieldLabel = this.root.querySelector(".metadata-custom-field-label");
    this.customFieldAdd = this.root.querySelector(".metadata-custom-field-add");
    this.configurationFeedback = this.root.querySelector(".metadata-configuration-feedback");
    this.fields = {};
    this.fieldWrappers = {};
    this.catalogLists = {};
    this.localizationArguments = null;
    this.definitions = [];
    this.configurationResult = null;
    this.configurationSelectedKey = null;
    this.events = {
        fieldChanged: () => {},
        removeAll: () => {},
        collapsedChanged: () => {},
        tabChanged: () => {},
        configurationFieldSaved: () => {},
        configurationFieldRemoved: () => {},
        configurationFieldAdded: () => {},
        localizationArgumentSaved: () => {},
        localizationArgumentRemoved: () => {}
    };

    this.setDefinitions(METADATA_DEFINITIONS);
    this.removeAllButton.addEventListener("click", () => this.events.removeAll());
    this.collapseButton.addEventListener("click", () => {
        this.events.collapsedChanged(!this.main.classList.contains("metadata-inspector-collapsed"));
    });
    this.tabButtons.forEach(button => {
        button.addEventListener("click", () => {
            const tab = button.dataset.metadataTab;
            this.setActiveTab(tab);
            this.events.tabChanged(tab);
        });
    });
    this.configurationField.addEventListener("change", () => {
        this.configurationSelectedKey = this.configurationField.value;
        this.populateConfigurationField();
        this.renderConfigurationEditorMessage("");
    });
    this.configurationSave.addEventListener("click", () => {
        this.events.configurationFieldSaved(this.configurationFieldPayload());
    });
    this.configurationRemove.addEventListener("click", () => {
        this.events.configurationFieldRemoved(this.configurationField.value);
    });
    this.customFieldForm.addEventListener("submit", event => {
        event.preventDefault();
        this.events.configurationFieldAdded({
            key: this.customFieldKey.value,
            label: this.customFieldLabel.value,
            contexts: ["dialogue", "choice"],
            values: []
        });
    });
}

MetadataInspectorView.prototype.createFields = function(definitions) {
    while(this.fieldsContainer.firstChild) this.fieldsContainer.removeChild(this.fieldsContainer.firstChild);
    Object.values(this.catalogLists).forEach(datalist => datalist.remove());
    this.fields = {};
    this.fieldWrappers = {};
    this.catalogLists = {};
    this.localizationArguments = null;

    definitions.forEach(definition => {
        if( definition.specialized === "localizationArguments" ) {
            this.createLocalizationArgumentsField(definition);
            return;
        }

        const fieldWrapper = this.document.createElement("label");
        fieldWrapper.className = "metadata-field-wrapper";
        fieldWrapper.setAttribute("for", "metadata-field-" + definition.key);

        const labelText = this.document.createElement("span");
        labelText.className = "metadata-field-label";
        labelText.textContent = definition.label;
        if( definition.discovered ) {
            const origin = this.document.createElement("span");
            origin.className = "metadata-field-origin";
            origin.textContent = "Custom";
            origin.title = "Discovered from the selected Ink tag";
            labelText.appendChild(origin);
        }
        fieldWrapper.appendChild(labelText);

        const hasFixedOptions = Array.isArray(definition.options) && definition.options.length > 0;
        const input = this.document.createElement(hasFixedOptions ? "select" : "input");
        if( hasFixedOptions ) {
            const emptyOption = this.document.createElement("option");
            emptyOption.value = "";
            emptyOption.textContent = "Not set";
            input.appendChild(emptyOption);
            definition.options.forEach(value => {
                const option = this.document.createElement("option");
                option.value = value;
                option.textContent = (definition.optionLabels && definition.optionLabels[value]) || value;
                input.appendChild(option);
            });
        } else {
            input.type = "text";
        }
        input.id = "metadata-field-" + definition.key;
        input.className = "form-control metadata-field";
        input.dataset.metadataKey = definition.key;
        input.autocomplete = "off";

        if( definition.catalog && !hasFixedOptions ) {
            const datalist = this.document.createElement("datalist");
            datalist.id = "metadata-catalog-" + definition.key;
            input.setAttribute("list", datalist.id);
            this.root.appendChild(datalist);
            this.catalogLists[definition.key] = datalist;
        }

        input.addEventListener("change", () => {
            this.events.fieldChanged(definition.key, input.value);
        });
        input.addEventListener("keydown", event => {
            if( event.key === "Enter" ) {
                event.preventDefault();
                input.blur();
            }
        });

        fieldWrapper.appendChild(input);
        this.fieldsContainer.appendChild(fieldWrapper);
        this.fields[definition.key] = input;
        this.fieldWrappers[definition.key] = fieldWrapper;
    });
};

MetadataInspectorView.prototype.createLocalizationArgumentsField = function(definition) {
    const wrapper = this.document.createElement("section");
    wrapper.className = "metadata-field-wrapper metadata-loc-args";

    const header = this.document.createElement("div");
    header.className = "metadata-loc-args-header";

    const label = this.document.createElement("span");
    label.className = "metadata-field-label";
    label.textContent = definition.label;
    header.appendChild(label);

    const addButton = this.document.createElement("button");
    addButton.type = "button";
    addButton.className = "btn metadata-loc-arg-add";
    addButton.textContent = "Add argument";
    addButton.addEventListener("click", () => {
        this.appendLocalizationArgumentRow({ name: "", type: "string", value: "", table: "", entry: "" }, null);
    });
    header.appendChild(addButton);
    wrapper.appendChild(header);

    const help = this.document.createElement("p");
    help.className = "metadata-loc-args-help";
    help.textContent = "Values can be literals or Ink expressions such as {reward}.";
    wrapper.appendChild(help);

    const list = this.document.createElement("div");
    list.className = "metadata-loc-args-list";
    wrapper.appendChild(list);

    this.fieldsContainer.appendChild(wrapper);
    this.fields[definition.key] = addButton;
    this.fieldWrappers[definition.key] = wrapper;
    this.localizationArguments = { wrapper: wrapper, list: list, addButton: addButton };
};

MetadataInspectorView.prototype.createLocalizationArgumentInput = function(labelText, className) {
    const label = this.document.createElement("label");
    label.className = "metadata-loc-arg-control";
    const caption = this.document.createElement("span");
    caption.textContent = labelText;
    label.appendChild(caption);
    const input = this.document.createElement("input");
    input.type = "text";
    input.className = "form-control metadata-loc-arg-input " + className;
    input.autocomplete = "off";
    label.appendChild(input);
    return { label: label, input: input };
};

MetadataInspectorView.prototype.appendLocalizationArgumentRow = function(argument, occurrenceIndex) {
    if( !this.localizationArguments ) return;

    const source = argument || {};
    const row = this.document.createElement("div");
    row.className = "metadata-loc-arg-row";
    if( Number.isInteger(occurrenceIndex) ) row.dataset.occurrenceIndex = String(occurrenceIndex);

    const nameControl = this.createLocalizationArgumentInput("Name", "metadata-loc-arg-name");
    nameControl.input.value = source.name || "";
    row.appendChild(nameControl.label);

    const typeLabel = this.document.createElement("label");
    typeLabel.className = "metadata-loc-arg-control";
    const typeCaption = this.document.createElement("span");
    typeCaption.textContent = "Type";
    typeLabel.appendChild(typeCaption);
    const typeSelect = this.document.createElement("select");
    typeSelect.className = "form-control metadata-loc-arg-input metadata-loc-arg-type";
    LOCALIZATION_ARGUMENT_TYPES.forEach(type => {
        const option = this.document.createElement("option");
        option.value = type;
        option.textContent = LOCALIZATION_ARGUMENT_TYPE_LABELS[type];
        typeSelect.appendChild(option);
    });
    if( source.type && !LOCALIZATION_ARGUMENT_TYPES.includes(source.type) ) {
        const invalidOption = this.document.createElement("option");
        invalidOption.value = source.type;
        invalidOption.textContent = source.type + " (invalid)";
        invalidOption.dataset.metadataInvalid = "true";
        typeSelect.appendChild(invalidOption);
    }
    typeSelect.value = source.type || "string";
    typeLabel.appendChild(typeSelect);
    row.appendChild(typeLabel);

    const valueControl = this.createLocalizationArgumentInput("Value / Ink expression", "metadata-loc-arg-value");
    valueControl.label.classList.add("metadata-loc-arg-value-control");
    valueControl.input.value = source.value || "";
    row.appendChild(valueControl.label);

    const localizedFields = this.document.createElement("div");
    localizedFields.className = "metadata-loc-arg-localized-fields";
    const tableControl = this.createLocalizationArgumentInput("Table", "metadata-loc-arg-table");
    tableControl.input.value = source.table || "";
    localizedFields.appendChild(tableControl.label);
    const entryControl = this.createLocalizationArgumentInput("Entry key", "metadata-loc-arg-entry");
    entryControl.input.value = source.entry || "";
    localizedFields.appendChild(entryControl.label);
    row.appendChild(localizedFields);

    const error = this.document.createElement("div");
    error.className = "metadata-loc-arg-error";
    error.setAttribute("role", "alert");
    row.appendChild(error);

    const actions = this.document.createElement("div");
    actions.className = "metadata-loc-arg-actions";
    const saveButton = this.document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "btn metadata-loc-arg-save";
    saveButton.textContent = Number.isInteger(occurrenceIndex) ? "Update" : "Save";
    actions.appendChild(saveButton);
    const removeButton = this.document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn metadata-loc-arg-remove";
    removeButton.textContent = Number.isInteger(occurrenceIndex) ? "Remove" : "Cancel";
    actions.appendChild(removeButton);
    row.appendChild(actions);

    const updateTypeFields = () => {
        const localized = typeSelect.value === "localized";
        valueControl.label.hidden = localized;
        localizedFields.hidden = !localized;
    };
    typeSelect.addEventListener("change", updateTypeFields);
    updateTypeFields();

    saveButton.addEventListener("click", () => {
        const payload = {
            name: nameControl.input.value,
            type: typeSelect.value,
            value: valueControl.input.value,
            table: tableControl.input.value,
            entry: entryControl.input.value
        };
        const validationMessage = validateLocalizationArgument(payload);
        error.textContent = validationMessage || "";
        row.classList.toggle("invalid", Boolean(validationMessage));
        if( !validationMessage ) this.events.localizationArgumentSaved(occurrenceIndex, payload);
    });
    removeButton.addEventListener("click", () => {
        if( Number.isInteger(occurrenceIndex) ) {
            this.events.localizationArgumentRemoved(occurrenceIndex);
        } else {
            row.remove();
        }
    });

    this.localizationArguments.list.appendChild(row);
};

MetadataInspectorView.prototype.renderLocalizationArguments = function(context) {
    if( !this.localizationArguments ) return;
    const list = this.localizationArguments.list;
    while(list.firstChild) list.removeChild(list.firstChild);
    if( !context ) return;

    const occurrences = context.metadata && context.metadata.occurrences
        ? context.metadata.occurrences[LOCALIZATION_ARGUMENT_KEY] || []
        : [];
    occurrences.forEach((entry, index) => {
        this.appendLocalizationArgumentRow(parseLocalizationArgument(entry.value), index);
    });
};

MetadataInspectorView.prototype.setDefinitions = function(definitions) {
    const nextDefinitions = Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
    if( JSON.stringify(this.definitions) === JSON.stringify(nextDefinitions) ) return;

    this.definitions = nextDefinitions.map(definition => ({
        key: definition.key,
        label: definition.label,
        catalog: definition.catalog,
        contexts: Array.isArray(definition.contexts) ? definition.contexts.slice() : null,
        options: Array.isArray(definition.options) ? definition.options.slice() : null,
        optionLabels: definition.optionLabels ? Object.assign({}, definition.optionLabels) : null,
        discovered: Boolean(definition.discovered),
        repeatable: Boolean(definition.repeatable),
        specialized: definition.specialized || null
    }));
    this.createFields(this.definitions);
};

MetadataInspectorView.prototype.setEvents = function(events) {
    this.events = Object.assign(this.events, events || {});
};

MetadataInspectorView.prototype.setCollapsed = function(collapsed) {
    this.main.classList.toggle("metadata-inspector-collapsed", collapsed);
    this.root.classList.toggle("collapsed", collapsed);
    this.collapseButton.textContent = collapsed ? "\u2039" : "\u203a";
    this.collapseButton.title = collapsed ? "Expand metadata inspector" : "Collapse metadata inspector";
    this.collapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");

    if( typeof ace !== "undefined" ) {
        setImmediate(() => ace.edit("editor").resize());
    }
};

MetadataInspectorView.prototype.setActiveTab = function(tab) {
    const activeTab = tab === "configuration" ? "configuration" : "metadata";
    this.tabButtons.forEach(button => {
        const active = button.dataset.metadataTab === activeTab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
    });
    this.tabPanels.forEach(panel => {
        panel.hidden = panel.dataset.metadataPanel !== activeTab;
    });
};

MetadataInspectorView.prototype.setFieldsEnabled = function(enabled, contextType) {
    this.definitions.forEach(definition => {
        const appliesToContext = !contextType || !definition.contexts || definition.contexts.includes(contextType);
        this.fieldWrappers[definition.key].hidden = !appliesToContext;
        const disabled = !enabled || !appliesToContext;
        this.fields[definition.key].disabled = disabled;
        if( definition.specialized === "localizationArguments" && this.localizationArguments ) {
            this.localizationArguments.wrapper.querySelectorAll("input, select, button").forEach(control => {
                control.disabled = disabled;
            });
        }
    });
    this.removeAllButton.disabled = !enabled;
};

MetadataInspectorView.prototype.renderCatalogs = function(catalogs) {
    Object.keys(this.catalogLists).forEach(key => {
        const datalist = this.catalogLists[key];
        while(datalist.firstChild) datalist.removeChild(datalist.firstChild);

        const values = catalogs && Array.isArray(catalogs[key]) ? catalogs[key] : [];
        values.forEach(value => {
            const option = this.document.createElement("option");
            option.value = value;
            datalist.appendChild(option);
        });
    });
};

MetadataInspectorView.prototype.renderConfiguration = function(configurationResult) {
    const configuration = configurationResult || {};
    if( configuration.status === "loaded" && configuration.path ) {
        this.configurationStatus.textContent = "Metadata: " + path.basename(configuration.path);
        this.configurationStatus.title = configuration.path;
        this.configurationStatus.classList.remove("warning");
    } else if( configuration.path ) {
        this.configurationStatus.textContent = "Catalog unavailable: " + path.basename(configuration.path);
        this.configurationStatus.title = configuration.path;
        this.configurationStatus.classList.add("warning");
    } else {
        this.configurationStatus.textContent = "Catalog unavailable until the story is saved.";
        this.configurationStatus.removeAttribute("title");
        this.configurationStatus.classList.add("warning");
    }
};

MetadataInspectorView.prototype.configurationFieldPayload = function() {
    return {
        key: this.configurationField.value,
        label: this.configurationLabel.value,
        contexts: this.configurationContexts.filter(input => input.checked).map(input => input.value),
        values: this.configurationValues.value.split(/\r?\n/)
    };
};

MetadataInspectorView.prototype.selectConfigurationField = function(key) {
    this.configurationSelectedKey = normalizeMetadataKey(key);
};

MetadataInspectorView.prototype.clearCustomFieldForm = function() {
    this.customFieldKey.value = "";
    this.customFieldLabel.value = "";
};

MetadataInspectorView.prototype.populateConfigurationField = function() {
    const result = this.configurationResult || {};
    const definition = (result.definitions || []).find(candidate => candidate.key === this.configurationField.value);
    const editable = canEditMetadataConfiguration(result);
    if( !definition ) {
        this.configurationLabel.value = "";
        this.configurationValues.value = "";
        this.configurationContexts.forEach(input => input.checked = false);
        this.configurationSave.disabled = true;
        this.configurationRemove.disabled = true;
        return;
    }

    const configured = configuredTag(result, definition.key);
    const rawDefinition = configured && configured.definition && !Array.isArray(configured.definition) && typeof configured.definition === "object"
        ? configured.definition
        : {};
    this.configurationLabel.value = typeof rawDefinition.label === "string" ? rawDefinition.label : "";
    this.configurationLabel.placeholder = definition.label || "Generated from the field key";
    this.configurationContexts.forEach(input => {
        input.checked = Array.isArray(definition.contexts) && definition.contexts.includes(input.value);
    });
    const values = result.catalogs && Array.isArray(result.catalogs[definition.key])
        ? result.catalogs[definition.key]
        : [];
    this.configurationValues.value = values.join("\n");

    this.configurationLabel.disabled = !editable;
    this.configurationContexts.forEach(input => input.disabled = !editable);
    this.configurationValues.disabled = !editable;
    this.configurationSave.disabled = !editable;
    this.configurationRemove.disabled = !editable || !configured;
    this.configurationRemove.textContent = BUILT_IN_KEYS.has(definition.key) ? "Reset override" : "Remove field";
};

MetadataInspectorView.prototype.renderConfigurationEditor = function(configurationResult) {
    this.configurationResult = configurationResult || {};
    const result = this.configurationResult;
    const editable = canEditMetadataConfiguration(result);
    const previousKey = this.configurationSelectedKey || this.configurationField.value;
    while(this.configurationField.firstChild) this.configurationField.removeChild(this.configurationField.firstChild);

    (result.definitions || METADATA_DEFINITIONS).forEach(definition => {
        const option = this.document.createElement("option");
        option.value = definition.key;
        option.textContent = definition.label + " (" + definition.key + ")";
        this.configurationField.appendChild(option);
    });
    const selectableKey = Array.from(this.configurationField.options).some(option => option.value === previousKey)
        ? previousKey
        : (this.configurationField.options[0] ? this.configurationField.options[0].value : "");
    this.configurationField.value = selectableKey;
    this.configurationSelectedKey = selectableKey;
    this.configurationField.disabled = this.configurationField.options.length === 0;

    if( !result.path ) {
        this.configurationEditorStatus.textContent = "Save the main Ink story before configuring metadata.";
        this.configurationEditorStatus.removeAttribute("title");
        this.configurationEditorStatus.classList.add("warning");
    } else if( result.status === "malformed" ) {
        this.configurationEditorStatus.textContent = "This JSON is malformed. Fix it manually; Inky will not overwrite it.";
        this.configurationEditorStatus.title = result.path;
        this.configurationEditorStatus.classList.add("warning");
    } else if( result.status === "missing" ) {
        this.configurationEditorStatus.textContent = "No sidecar yet. Saving the story or a field creates " + path.basename(result.path) + ".";
        this.configurationEditorStatus.title = result.path;
        this.configurationEditorStatus.classList.remove("warning");
    } else if( result.status === "invalid" ) {
        this.configurationEditorStatus.textContent = "Saving a field upgrades this configuration to schemaVersion 2.";
        this.configurationEditorStatus.title = result.path;
        this.configurationEditorStatus.classList.add("warning");
    } else {
        this.configurationEditorStatus.textContent = "Editing " + path.basename(result.path) + ".";
        this.configurationEditorStatus.title = result.path;
        this.configurationEditorStatus.classList.remove("warning");
    }

    this.customFieldKey.disabled = !editable;
    this.customFieldLabel.disabled = !editable;
    this.customFieldAdd.disabled = !editable;
    this.populateConfigurationField();
};

MetadataInspectorView.prototype.renderConfigurationEditorMessage = function(message, isError) {
    this.configurationFeedback.textContent = message || "";
    this.configurationFeedback.classList.toggle("error", Boolean(message && isError));
    this.configurationFeedback.classList.toggle("success", Boolean(message && !isError));
};

MetadataInspectorView.prototype.renderValidation = function(messages) {
    while(this.validationList.firstChild) this.validationList.removeChild(this.validationList.firstChild);

    if( !messages || messages.length === 0 ) {
        const item = this.document.createElement("li");
        item.className = "metadata-validation-empty";
        item.textContent = "No validation warnings.";
        this.validationList.appendChild(item);
        return;
    }

    messages.forEach(message => {
        const item = this.document.createElement("li");
        item.className = "metadata-validation-" + (message.severity || "warning");
        item.textContent = message.message;
        this.validationList.appendChild(item);
    });
};

MetadataInspectorView.prototype.renderUnavailable = function(configurationResult, messages) {
    this.status.textContent = "No supported dialogue or choice line selected.";
    this.status.classList.add("unavailable");
    this.lineNumber.textContent = "\u2014";
    this.contextType.textContent = "\u2014";
    this.definitions.forEach(definition => {
        if( definition.specialized !== "localizationArguments" ) this.setFieldValue(definition, "");
    });
    this.renderLocalizationArguments(null);
    this.setFieldsEnabled(false, null);
    this.renderCatalogs(configurationResult && configurationResult.catalogs);
    this.renderConfiguration(configurationResult);
    this.renderValidation(messages);
};

MetadataInspectorView.prototype.setFieldValue = function(definition, value) {
    const field = this.fields[definition.key];
    const fieldValue = value || "";
    if( field.tagName !== "SELECT" ) {
        field.value = fieldValue;
        return;
    }

    Array.from(field.options)
        .filter(option => option.dataset.metadataInvalid === "true")
        .forEach(option => option.remove());

    const matchingOption = (definition.options || []).find(option => {
        return option.toLowerCase() === fieldValue.toLowerCase();
    });
    if( matchingOption || !fieldValue ) {
        field.value = matchingOption || "";
        return;
    }

    const invalidOption = this.document.createElement("option");
    invalidOption.value = fieldValue;
    invalidOption.textContent = fieldValue + " (invalid)";
    invalidOption.dataset.metadataInvalid = "true";
    field.appendChild(invalidOption);
    field.value = fieldValue;
};

MetadataInspectorView.prototype.renderContext = function(context, configurationResult, messages) {
    const contextLabel = context.type === "choice" ? "choice" : "dialogue";
    this.status.textContent = "Editing metadata attached to the selected " + contextLabel + ".";
    this.status.classList.remove("unavailable");
    this.lineNumber.textContent = String(context.lineNumber);
    this.contextType.textContent = contextLabel[0].toUpperCase() + contextLabel.substring(1);

    this.definitions.forEach(definition => {
        if( definition.specialized === "localizationArguments" ) {
            this.renderLocalizationArguments(context);
        } else {
            this.setFieldValue(definition, context.metadata.values[definition.key]);
        }
    });

    this.setFieldsEnabled(true, context.type);
    this.renderCatalogs(configurationResult && configurationResult.catalogs);
    this.renderConfiguration(configurationResult);
    this.renderValidation(messages);
};

exports.MetadataInspectorView = MetadataInspectorView;
