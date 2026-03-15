import * as vscode from "vscode";
import { CardPreviewPanel } from "./card-preview-panel";
import { generateWithAI } from "./llm-generator";

const HOST_OPTIONS = [
  { label: "$(globe) Generic", value: "generic", description: "No host constraints" },
  { label: "$(comment-discussion) Microsoft Teams", value: "teams", description: "v1.6, max 6 actions" },
  { label: "$(mail) Outlook", value: "outlook", description: "v1.4, limited elements" },
  { label: "$(browser) Web Chat", value: "webchat", description: "v1.6, full support" },
  { label: "$(window) Windows", value: "windows", description: "v1.6, subset" },
];

const INTENT_OPTIONS = [
  { label: "$(sparkle) Auto-detect", value: undefined, description: "Let AI choose the best layout" },
  { label: "$(bell) Notification", value: "notification", description: "Alert, message, announcement" },
  { label: "$(check) Approval", value: "approval", description: "Approve/reject with actions" },
  { label: "$(edit) Form / Survey", value: "form", description: "Input fields and submit" },
  { label: "$(graph) Dashboard", value: "dashboard", description: "KPIs, metrics, charts" },
  { label: "$(eye) Data Display", value: "display", description: "Tables, facts, lists" },
  { label: "$(person) Profile / Contact", value: "profile", description: "Person card with details" },
  { label: "$(pulse) Status Update", value: "status", description: "Activity or progress" },
  { label: "$(list-unordered) List", value: "list", description: "Items with titles" },
  { label: "$(file-media) Image Gallery", value: "gallery", description: "Image set or carousel" },
];

export async function registerGenerateCommand(context: vscode.ExtensionContext) {
  // Check if user has text selected — use it as the description
  const editor = vscode.window.activeTextEditor;
  const selection = editor?.document.getText(editor.selection);

  const description =
    selection && selection.length > 0
      ? selection
      : await vscode.window.showInputBox({
          prompt: "Describe the Adaptive Card you want to generate",
          placeHolder: "e.g., Create a flight status card with departure, arrival, and gate info",
        });

  if (!description) return;

  const hostPick = await vscode.window.showQuickPick(HOST_OPTIONS, {
    placeHolder: "Select target host",
  });

  const intentPick = await vscode.window.showQuickPick(INTENT_OPTIONS, {
    placeHolder: "Select card intent (or let AI decide)",
  });

  // Show progress
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Generating Adaptive Card...",
      cancellable: false,
    },
    async () => {
      try {
        const host = (hostPick?.value as any) || "generic";
        const intent = intentPick?.value as any;
        let card: Record<string, unknown> | null = null;
        let generationMethod = "deterministic";

        // Try AI provider if configured
        const aiResult = await generateWithAI(description, host, intent);
        if (aiResult) {
          card = aiResult.card;
          generationMethod = aiResult.provider;
        }

        // Validate & post-process the Copilot output, or fall back to deterministic
        const { validateCardFull, optimizeCard, generateCard } = await import(
          "adaptive-cards-mcp"
        );

        if (card) {
          // Validate Copilot output
          const validation = validateCardFull({ card, host });
          if (!validation.valid) {
            // Try to auto-fix with optimizer
            const optimized = optimizeCard({
              card,
              goals: ["accessibility", "modern"],
              host,
            });
            card = optimized.card;
          }
        } else {
          // Fallback to deterministic generation
          const result = await generateCard({
            content: description,
            host,
            intent,
          });
          card = result.card;
          generationMethod = "pattern-matching";
        }

        // Final validation
        const finalValidation = validateCardFull({ card, host });

        // Open JSON in a new editor
        const doc = await vscode.workspace.openTextDocument({
          content: JSON.stringify(card, null, 2),
          language: "json",
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

        // Show preview
        CardPreviewPanel.createOrShow(context.extensionUri, card);

        // Show status
        const aiLabel =
          generationMethod === "pattern-matching" ? "Pattern-matching" : `AI (${generationMethod})`;
        const statusMsg = finalValidation.valid
          ? `[${aiLabel}] Card generated! Accessibility: ${finalValidation.accessibility.score}/100, Elements: ${finalValidation.stats.elementCount}`
          : `[${aiLabel}] Card generated with ${finalValidation.errors.filter((e) => e.severity === "error").length} issue(s)`;
        vscode.window.showInformationMessage(statusMsg);
      } catch (e) {
        vscode.window.showErrorMessage(
          "Error generating card: " + (e instanceof Error ? e.message : e)
        );
      }
    }
  );
}
