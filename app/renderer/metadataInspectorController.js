const { resolveMetadataContext } = require("./metadataContextResolver.js");
const {
    setMetadataValue,
    removeAllManagedMetadata
} = require("./metadataDocumentEditor.js");
const { loadMetadataConfiguration } = require("./metadataConfigurationLoader.js");
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

function refresh() {
    refreshPending = false;

    if( !activeInkFile ) {
        currentContext = null;
        view.renderUnavailable(configurationResult, validateMetadata(null, configurationResult));
        return;
    }

    currentContext = resolveMetadataContext(activeInkFile.getValue(), currentCursorRow);
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

function reloadConfiguration() {
    const mainInkPath = currentProject && currentProject.mainInk
        ? currentProject.mainInk.absolutePath()
        : null;
    configurationResult = loadMetadataConfiguration(mainInkPath);
    scheduleRefresh();
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
        }
    });

    view.setCollapsed(window.localStorage.getItem("inky.metadataInspector.collapsed") === "true");
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
