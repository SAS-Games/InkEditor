const path = require("path");

const {
    METADATA_DEFINITIONS,
    normalizeMetadataKey
} = require("./metadataDefinitions.js");
const {
    configuredTag,
    canEditMetadataConfiguration
} = require("./metadataConfigurationEditor.js");

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
        configurationFieldAdded: () => {}
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

    definitions.forEach(definition => {
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

        const input = this.document.createElement("input");
        input.type = "text";
        input.id = "metadata-field-" + definition.key;
        input.className = "form-control metadata-field";
        input.dataset.metadataKey = definition.key;
        input.autocomplete = "off";

        if( definition.catalog ) {
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

MetadataInspectorView.prototype.setDefinitions = function(definitions) {
    const nextDefinitions = Array.isArray(definitions) ? definitions : METADATA_DEFINITIONS;
    if( JSON.stringify(this.definitions) === JSON.stringify(nextDefinitions) ) return;

    this.definitions = nextDefinitions.map(definition => ({
        key: definition.key,
        label: definition.label,
        catalog: definition.catalog,
        contexts: Array.isArray(definition.contexts) ? definition.contexts.slice() : null,
        discovered: Boolean(definition.discovered)
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
        this.fields[definition.key].disabled = !enabled || !appliesToContext;
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
        this.configurationEditorStatus.textContent = "No sidecar yet. Saving a field creates " + path.basename(result.path) + ".";
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
    Object.values(this.fields).forEach(field => field.value = "");
    this.setFieldsEnabled(false, null);
    this.renderCatalogs(configurationResult && configurationResult.catalogs);
    this.renderConfiguration(configurationResult);
    this.renderValidation(messages);
};

MetadataInspectorView.prototype.renderContext = function(context, configurationResult, messages) {
    const contextLabel = context.type === "choice" ? "choice" : "dialogue";
    this.status.textContent = "Editing metadata attached to the selected " + contextLabel + ".";
    this.status.classList.remove("unavailable");
    this.lineNumber.textContent = String(context.lineNumber);
    this.contextType.textContent = contextLabel[0].toUpperCase() + contextLabel.substring(1);

    Object.keys(this.fields).forEach(key => {
        this.fields[key].value = context.metadata.values[key] || "";
    });

    this.setFieldsEnabled(true, context.type);
    this.renderCatalogs(configurationResult && configurationResult.catalogs);
    this.renderConfiguration(configurationResult);
    this.renderValidation(messages);
};

exports.MetadataInspectorView = MetadataInspectorView;
