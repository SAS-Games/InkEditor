const { resolveMetadataContext } = require("./metadataContextResolver.js");
const { discoverMetadataDefinitions } = require("./metadataDefinitions.js");
const {
    setMetadataValue,
    removeAllManagedMetadata
} = require("./metadataDocumentEditor.js");
const { loadMetadataConfiguration } = require("./metadataConfigurationLoader.js");
const {
    saveMetadataField,
    removeMetadataField
} = require("./metadataConfigurationEditor.js");
const { METADATA_KEYS, normalizeMetadataKey } = require("./metadataDefinitions.js");
const { validateMetadata } = require("./metadataValidator.js");
const { MetadataInspectorView } = require("./metadataInspectorView.js");

let editorView = null;
let view = null;
let currentProject = null;
let activeInkFile = null;
let currentCursorRow = 0;
let currentContext = null;
let refreshPending = false;
let configurationResult = loadMetadataConfiguration(null);

function resolveContextWithDiscoveredDefinitions(text, cursorRow, configuredDefinitions) {
    const baseDefinitions = Array.isArray(configuredDefinitions) ? configuredDefinitions : [];
    let context = resolveMetadataContext(text, cursorRow, baseDefinitions);
    if( !context ) return { context: null, definitions: baseDefinitions };

    const discoveredDefinitions = discoverMetadataDefinitions(
        context.metadata.entries,
        baseDefinitions,
        context.type
    );
    if( discoveredDefinitions.length === 0 ) {
        return { context: context, definitions: baseDefinitions };
    }

    const combinedDefinitions = baseDefinitions.concat(discoveredDefinitions);
    context = resolveMetadataContext(text, cursorRow, combinedDefinitions);
    return { context: context, definitions: combinedDefinitions };
}

function refresh() {
    refreshPending = false;

    if( !activeInkFile ) {
        currentContext = null;
        view.setDefinitions(configurationResult.definitions);
        view.renderUnavailable(configurationResult, validateMetadata(null, configurationResult));
        return;
    }

    const resolved = resolveContextWithDiscoveredDefinitions(
        activeInkFile.getValue(),
        currentCursorRow,
        configurationResult.definitions
    );
    currentContext = resolved.context;
    view.setDefinitions(resolved.definitions);
    const messages = validateMetadata(currentContext, configurationResult);
    if( currentContext ) {
        view.renderContext(currentContext, configurationResult, messages);
    } else {
        view.renderUnavailable(configurationResult, messages);
    }
}

function scheduleRefresh() {
    if( refreshPending ) return;
    refreshPending = true;
    setImmediate(refresh);
}

function reloadConfiguration(message) {
    const mainInkPath = currentProject && currentProject.mainInk
        ? currentProject.mainInk.absolutePath()
        : null;
    configurationResult = loadMetadataConfiguration(mainInkPath);
    if( view ) {
        view.setDefinitions(configurationResult.definitions);
        view.renderConfigurationEditor(configurationResult);
        if( message ) view.renderConfigurationEditorMessage(message, false);
    }
    scheduleRefresh();
}

function reportConfigurationError(error) {
    view.renderConfigurationEditorMessage(error && error.message ? error.message : String(error), true);
}

function applyEdit(edit) {
    if( !edit ) {
        scheduleRefresh();
        return;
    }

    editorView.applyDocumentEdit(edit);
    scheduleRefresh();
}

function initialize(newEditorView) {
    editorView = newEditorView;
    view = new MetadataInspectorView(document);
    view.setDefinitions(configurationResult.definitions);
    view.setEvents({
        fieldChanged: (key, value) => {
            if( !currentContext ) return;
            applyEdit(setMetadataValue(currentContext, key, value));
        },
        removeAll: () => {
            if( !currentContext ) return;
            applyEdit(removeAllManagedMetadata(currentContext));
        },
        collapsedChanged: collapsed => {
            view.setCollapsed(collapsed);
            window.localStorage.setItem("inky.metadataInspector.collapsed", collapsed ? "true" : "false");
        },
        tabChanged: tab => {
            window.localStorage.setItem("inky.metadataInspector.activeTab", tab);
        },
        configurationFieldSaved: field => {
            try {
                saveMetadataField(configurationResult, field);
                view.selectConfigurationField(field.key);
                reloadConfiguration("Saved the " + normalizeMetadataKey(field.key) + " field.");
            } catch(error) {
                reportConfigurationError(error);
            }
        },
        configurationFieldRemoved: key => {
            try {
                removeMetadataField(configurationResult, key);
                view.selectConfigurationField(key);
                reloadConfiguration((METADATA_KEYS.includes(key) ? "Reset" : "Removed") + " the " + key + " field configuration.");
            } catch(error) {
                reportConfigurationError(error);
            }
        },
        configurationFieldAdded: field => {
            try {
                const canonicalKey = normalizeMetadataKey(field.key);
                if( configurationResult.definitions.some(definition => definition.key === canonicalKey) ) {
                    throw new Error("A field with that key already exists. Select it above to edit it.");
                }
                saveMetadataField(configurationResult, field);
                view.selectConfigurationField(field.key);
                view.clearCustomFieldForm();
                reloadConfiguration("Added the " + canonicalKey + " field.");
            } catch(error) {
                reportConfigurationError(error);
            }
        }
    });

    view.setCollapsed(window.localStorage.getItem("inky.metadataInspector.collapsed") === "true");
    view.setActiveTab(window.localStorage.getItem("inky.metadataInspector.activeTab"));
    view.renderConfigurationEditor(configurationResult);
    refresh();
}

function setProject(project) {
    currentProject = project;
    activeInkFile = project ? project.activeInkFile : null;
    currentCursorRow = editorView.getCurrentCursorPos().row;
    reloadConfiguration();
}

function setActiveInkFile(inkFile) {
    activeInkFile = inkFile;
    currentCursorRow = editorView.getCurrentCursorPos().row;
    scheduleRefresh();
}

function cursorChanged(position) {
    if( position && Number.isInteger(position.row) ) currentCursorRow = position.row;
    scheduleRefresh();
}

exports.MetadataInspectorController = {
    initialize: initialize,
    setProject: setProject,
    setActiveInkFile: setActiveInkFile,
    reloadConfiguration: reloadConfiguration,
    documentChanged: scheduleRefresh,
    cursorChanged: cursorChanged
};
exports.resolveContextWithDiscoveredDefinitions = resolveContextWithDiscoveredDefinitions;
