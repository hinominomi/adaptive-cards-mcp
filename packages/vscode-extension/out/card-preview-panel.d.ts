import * as vscode from "vscode";
export declare class CardPreviewPanel {
    static currentPanel: CardPreviewPanel | undefined;
    private static readonly viewType;
    private readonly panel;
    private disposables;
    static createOrShow(extensionUri: vscode.Uri, card: Record<string, unknown>): void;
    private constructor();
    update(card: Record<string, unknown>): void;
    private dispose;
    private getHtml;
}
