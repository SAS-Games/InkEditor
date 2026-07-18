const path = require("path");

const { METADATA_DEFINITIONS } = require("./metadataDefinitions.js");

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
    this.fields = {};
    this.catalogLists = {};
    this.events = {
        fieldChanged: () => {},
        removeAll: () => {},
        collapsedChanged: () => {}
    };

    this.createFields();
    this.removeAllButton.addEventListener("click", () => this.events.removeAll());
    this.collapseButton.addEventListener("click", () => {
        this.events.collapsedChanged(!this.main.classList.contains("metadata-inspector-collapsed"));
    });
}

MetadataInspectorView.prototype.createFields = function() {
    METADATA_DEFINITIONS.forEach(definition => {
        const fieldWrapper = this.document.createElement("label");
        fieldWrapper.className = "metadata-field-wrapper";
        fieldWrapper.setAttribute("for", "metadata-field-" + definition.key);

        const labelText = this.document.createElement("span");
        labelText.className = "metadata-field-label";
        labelText.textContent = definition.label;
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
    });
};

MetadataInspectorView.prototype.setEvents = function(events) {
    this.events = Object.assign(this.events, events || {});
};

MetadataInspectorView.prototype.setCollapsed = function(collapsed) {
    this.main.classList.toggle("metadata-inspector-collapsed", collapsed);
    this.root.classList.toggle("collapsed", collapsed);
    this.collapseButton.textContent = collapsed ? "‹" : "›";
    this.collapseButton.title = collapsed ? "Expand metadata inspector" : "Collapse metadata inspector";
    this.collapseButton.setAttribute("aria-expanded", collapsed ? "false" : "true");

    if( typeof ace !== "undefined" ) {
        setImmediate(() => ace.edit("editor").resize());
    }
};

MetadataInspectorView.prototype.setFieldsEnabled = function(enabled) {
    Object.values(this.fields).forEach(field => field.disabled = !enabled);
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
        this.configurationStatus.textContent = "Catalog: " + path.basename(configuration.path);
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
    this.status.textContent = "No supported dialogue line selected.";
    this.status.classList.add("unavailable");
    this.lineNumber.textContent = "—";
    this.contextType.textContent = "—";
    Object.values(this.fields).forEach(field => field.value = "");
    this.setFieldsEnabled(false);
    this.renderCatalogs(configurationResult && configurationResult.catalogs);
    this.renderConfiguration(configurationResult);
    this.renderValidation(messages);
};

MetadataInspectorView.prototype.renderContext = function(context, configurationResult, messages) {
    this.status.textContent = "Editing metadata attached to the selected line.";
    this.status.classList.remove("unavailable");
    this.lineNumber.textContent = String(context.lineNumber);
    this.contextType.textContent = "Dialogue";

    Object.keys(this.fields).forEach(key => {
        this.fields[key].value = context.metadata.values[key] || "";
    });

    this.setFieldsEnabled(true);
    this.renderCatalogs(configurationResult && configurationResult.catalogs);
    this.renderConfiguration(configurationResult);
    this.renderValidation(messages);
};

exports.MetadataInspectorView = MetadataInspectorView;
