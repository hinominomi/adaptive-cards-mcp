"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const generate_command_1 = require("./generate-command");
const card_preview_panel_1 = require("./card-preview-panel");
const codelens_provider_1 = require("./codelens-provider");
let diagnosticCollection;
function activate(context) {
    diagnosticCollection = vscode.languages.createDiagnosticCollection("adaptiveCards");
    context.subscriptions.push(diagnosticCollection);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("adaptiveCards.generate", () => (0, generate_command_1.registerGenerateCommand)(context)));
    context.subscriptions.push(vscode.commands.registerCommand("adaptiveCards.preview", () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor");
            return;
        }
        try {
            const card = JSON.parse(editor.document.getText());
            card_preview_panel_1.CardPreviewPanel.createOrShow(context.extensionUri, card);
        }
        catch {
            vscode.window.showErrorMessage("Active editor does not contain valid JSON");
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("adaptiveCards.validate", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage("No active editor");
            return;
        }
        try {
            const card = JSON.parse(editor.document.getText());
            const { validateCardFull } = await Promise.resolve().then(() => __importStar(require("adaptive-cards-ai-builder")));
            const result = validateCardFull({ card });
            const diags = [];
            for (const err of result.errors) {
                const severity = err.severity === "error"
                    ? vscode.DiagnosticSeverity.Error
                    : err.severity === "warning"
                        ? vscode.DiagnosticSeverity.Warning
                        : vscode.DiagnosticSeverity.Information;
                const diag = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), `[${err.rule}] ${err.message}`, severity);
                diags.push(diag);
            }
            diagnosticCollection.set(editor.document.uri, diags);
            if (result.valid) {
                vscode.window.showInformationMessage(`Card is valid! Accessibility: ${result.accessibility.score}/100, Elements: ${result.stats.elementCount}`);
            }
            else {
                vscode.window.showWarningMessage(`Card has ${result.errors.filter((e) => e.severity === "error").length} error(s)`);
            }
        }
        catch (e) {
            vscode.window.showErrorMessage("Invalid JSON: " + (e instanceof Error ? e.message : e));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("adaptiveCards.dataToCard", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        const selection = editor.document.getText(editor.selection);
        if (!selection) {
            vscode.window.showWarningMessage("Select data (JSON or CSV) first");
            return;
        }
        const title = await vscode.window.showInputBox({ prompt: "Card title", placeHolder: "My Data" });
        try {
            const { dataToCard } = await Promise.resolve().then(() => __importStar(require("adaptive-cards-ai-builder")));
            let data = selection;
            try {
                data = JSON.parse(selection);
            }
            catch {
                /* treat as CSV */
            }
            const result = await dataToCard({ data: data, title: title || undefined });
            const doc = await vscode.workspace.openTextDocument({
                content: JSON.stringify(result.card, null, 2),
                language: "json",
            });
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            card_preview_panel_1.CardPreviewPanel.createOrShow(context.extensionUri, result.card);
        }
        catch (e) {
            vscode.window.showErrorMessage("Error: " + (e instanceof Error ? e.message : e));
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("adaptiveCards.optimize", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor)
            return;
        try {
            const card = JSON.parse(editor.document.getText());
            const { optimizeCard } = await Promise.resolve().then(() => __importStar(require("adaptive-cards-ai-builder")));
            const result = optimizeCard({ card });
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(editor.document.positionAt(0), editor.document.positionAt(editor.document.getText().length));
            edit.replace(editor.document.uri, fullRange, JSON.stringify(result.card, null, 2));
            await vscode.workspace.applyEdit(edit);
            const changeList = result.changes.map((c) => c.description).join(", ");
            vscode.window.showInformationMessage(`Optimized! ${result.changes.length} changes: ${changeList}`);
        }
        catch (e) {
            vscode.window.showErrorMessage("Error: " + (e instanceof Error ? e.message : e));
        }
    }));
    // Register CodeLens
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: "**/*.card.json" }, new codelens_provider_1.AdaptiveCardCodeLensProvider()));
    // Status bar
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = "$(symbol-misc) AC Builder";
    statusBar.tooltip = "Adaptive Cards AI Builder";
    statusBar.command = "adaptiveCards.generate";
    statusBar.show();
    context.subscriptions.push(statusBar);
}
function deactivate() {
    diagnosticCollection?.dispose();
}
//# sourceMappingURL=extension.js.map