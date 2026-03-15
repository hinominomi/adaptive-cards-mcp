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
exports.AdaptiveCardCodeLensProvider = void 0;
const vscode = __importStar(require("vscode"));
class AdaptiveCardCodeLensProvider {
    provideCodeLenses(document) {
        // Only provide CodeLens for .card.json files
        if (!document.fileName.endsWith(".card.json"))
            return [];
        try {
            const text = document.getText();
            const parsed = JSON.parse(text);
            if (parsed.type !== "AdaptiveCard")
                return [];
        }
        catch {
            return [];
        }
        const topOfDocument = new vscode.Range(0, 0, 0, 0);
        return [
            new vscode.CodeLens(topOfDocument, {
                title: "$(eye) Preview",
                command: "adaptiveCards.preview",
                tooltip: "Preview this Adaptive Card",
            }),
            new vscode.CodeLens(topOfDocument, {
                title: "$(check) Validate",
                command: "adaptiveCards.validate",
                tooltip: "Validate schema, accessibility, and host compatibility",
            }),
            new vscode.CodeLens(topOfDocument, {
                title: "$(sparkle) Optimize",
                command: "adaptiveCards.optimize",
                tooltip: "Optimize for accessibility and best practices",
            }),
        ];
    }
}
exports.AdaptiveCardCodeLensProvider = AdaptiveCardCodeLensProvider;
//# sourceMappingURL=codelens-provider.js.map