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
exports.registerGenerateCommand = registerGenerateCommand;
const vscode = __importStar(require("vscode"));
const card_preview_panel_1 = require("./card-preview-panel");
const HOST_OPTIONS = [
    { label: "Generic", value: "generic" },
    { label: "Microsoft Teams", value: "teams" },
    { label: "Outlook", value: "outlook" },
    { label: "Web Chat", value: "webchat" },
    { label: "Windows", value: "windows" },
];
const INTENT_OPTIONS = [
    { label: "Auto-detect", value: undefined },
    { label: "Notification", value: "notification" },
    { label: "Approval", value: "approval" },
    { label: "Form / Survey", value: "form" },
    { label: "Dashboard", value: "dashboard" },
    { label: "Data Display", value: "display" },
    { label: "Profile / Contact", value: "profile" },
    { label: "Status Update", value: "status" },
    { label: "List", value: "list" },
    { label: "Image Gallery", value: "gallery" },
];
async function registerGenerateCommand(context) {
    // Check if user has text selected — use it as the description
    const editor = vscode.window.activeTextEditor;
    const selection = editor?.document.getText(editor.selection);
    const description = selection && selection.length > 0
        ? selection
        : await vscode.window.showInputBox({
            prompt: "Describe the Adaptive Card you want to generate",
            placeHolder: "e.g., Create a flight status card with departure, arrival, and gate info",
        });
    if (!description)
        return;
    const hostPick = await vscode.window.showQuickPick(HOST_OPTIONS, {
        placeHolder: "Select target host",
    });
    const intentPick = await vscode.window.showQuickPick(INTENT_OPTIONS, {
        placeHolder: "Select card intent (or auto-detect)",
    });
    try {
        const { generateCard } = await Promise.resolve().then(() => __importStar(require("adaptive-cards-ai-builder")));
        const result = await generateCard({
            content: description,
            host: hostPick?.value || "generic",
            intent: intentPick?.value || undefined,
        });
        // Open JSON in a new editor
        const doc = await vscode.workspace.openTextDocument({
            content: JSON.stringify(result.card, null, 2),
            language: "json",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        // Show preview
        card_preview_panel_1.CardPreviewPanel.createOrShow(context.extensionUri, result.card);
        // Show validation summary
        const { valid, accessibility, stats } = result.validation;
        const statusMsg = valid
            ? `Card generated! Accessibility: ${accessibility.score}/100, Elements: ${stats.elementCount}`
            : `Card generated with ${result.validation.errors.filter((e) => e.severity === "error").length} validation issue(s)`;
        vscode.window.showInformationMessage(statusMsg);
    }
    catch (e) {
        vscode.window.showErrorMessage("Error generating card: " + (e instanceof Error ? e.message : e));
    }
}
//# sourceMappingURL=generate-command.js.map