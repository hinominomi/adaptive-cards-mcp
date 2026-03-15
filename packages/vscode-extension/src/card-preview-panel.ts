import * as vscode from "vscode";

export class CardPreviewPanel {
  public static currentPanel: CardPreviewPanel | undefined;
  private static readonly viewType = "adaptiveCardPreview";
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private lastCard: Record<string, unknown> = {};

  public static createOrShow(extensionUri: vscode.Uri, card: Record<string, unknown>) {
    const column = vscode.ViewColumn.Beside;

    if (CardPreviewPanel.currentPanel) {
      CardPreviewPanel.currentPanel.panel.reveal(column);
      CardPreviewPanel.currentPanel.update(card);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      CardPreviewPanel.viewType,
      "Adaptive Card Preview",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    CardPreviewPanel.currentPanel = new CardPreviewPanel(panel, extensionUri, card);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, card: Record<string, unknown>) {
    this.panel = panel;
    this.update(card);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        if (message.command === "openDesigner") {
          await this.openInDesigner();
        } else if (message.command === "copyJson") {
          await vscode.env.clipboard.writeText(JSON.stringify(this.lastCard, null, 2));
          vscode.window.showInformationMessage("Card JSON copied to clipboard");
        }
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public update(card: Record<string, unknown>) {
    this.lastCard = card;
    this.panel.webview.html = this.getHtml(card);
  }

  private async openInDesigner() {
    // Copy card JSON to clipboard
    const json = JSON.stringify(this.lastCard, null, 2);
    await vscode.env.clipboard.writeText(json);

    // Open the AC Designer in the browser
    const designerUrl = "https://adaptivecards.microsoft.com/designer";
    await vscode.env.openExternal(vscode.Uri.parse(designerUrl));

    vscode.window.showInformationMessage(
      "Card JSON copied to clipboard. In the Designer: click the JSON editor (bottom-left), select all (Cmd+A), and paste (Cmd+V)."
    );
  }

  private dispose() {
    CardPreviewPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtml(card: Record<string, unknown>): string {
    const isDark = vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark;
    const cardJson = JSON.stringify(card, null, 2);
    const escapedJson = cardJson.replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
    const bg = isDark ? "#1e1e1e" : "#ffffff";
    const fg = isDark ? "#e0e0e0" : "#333333";
    const cardBg = isDark ? "#252526" : "#ffffff";
    const borderColor = isDark ? "#333" : "#ddd";
    const codeBg = isDark ? "#1a1a1a" : "#f5f5f5";
    const subtleColor = isDark ? "#888" : "#666";
    const emphasisBg = isDark ? "#333333" : "#f0f0f0";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Adaptive Card Preview</title>
  <script src="https://unpkg.com/adaptivecards@3.0.4/dist/adaptivecards.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', -apple-system, sans-serif;
      margin: 0; padding: 0;
      background: ${bg}; color: ${fg};
    }

    /* Toolbar */
    .toolbar {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px;
      background: ${isDark ? "#252526" : "#f3f3f3"};
      border-bottom: 1px solid ${borderColor};
      position: sticky; top: 0; z-index: 10;
    }
    .toolbar-title {
      font-size: 13px; font-weight: 600; flex: 1;
    }
    .toolbar-btn {
      padding: 6px 12px; border: 1px solid ${borderColor};
      border-radius: 4px; font-size: 12px; cursor: pointer;
      font-family: inherit; font-weight: 500;
      background: ${isDark ? "#333" : "#fff"}; color: ${fg};
      display: flex; align-items: center; gap: 4px;
    }
    .toolbar-btn:hover { background: ${isDark ? "#444" : "#e8e8e8"}; }
    .toolbar-btn.primary {
      background: #0078d4; color: white; border-color: #0078d4;
    }
    .toolbar-btn.primary:hover { background: #106ebe; }

    /* Tabs */
    .tabs {
      display: flex; border-bottom: 1px solid ${borderColor};
      background: ${isDark ? "#1e1e1e" : "#f9f9f9"};
    }
    .tab {
      padding: 8px 16px; font-size: 12px; cursor: pointer;
      border-bottom: 2px solid transparent; color: ${subtleColor};
      font-family: inherit; background: none; border-top: none;
      border-left: none; border-right: none;
    }
    .tab:hover { color: ${fg}; }
    .tab.active { color: #0078d4; border-bottom-color: #0078d4; font-weight: 600; }

    /* Content */
    .content { padding: 16px; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Preview */
    #card-container {
      max-width: 500px; margin: 0 auto;
      border: 1px solid ${borderColor}; border-radius: 8px;
      overflow: hidden; background: ${cardBg};
      box-shadow: 0 2px 8px rgba(0,0,0,${isDark ? "0.3" : "0.1"});
    }
    .ac-adaptiveCard { padding: 12px !important; }

    /* Host selector */
    .host-bar {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 12px; font-size: 12px; color: ${subtleColor};
    }
    .host-bar select {
      background: ${isDark ? "#2d2d2d" : "#fff"}; color: ${fg};
      border: 1px solid ${borderColor}; border-radius: 4px;
      padding: 4px 8px; font-size: 12px; font-family: inherit;
    }

    /* JSON */
    pre {
      background: ${codeBg}; border: 1px solid ${borderColor};
      border-radius: 6px; padding: 12px; overflow: auto;
      font-size: 12px; font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace;
      max-height: 600px; margin: 0; line-height: 1.5;
      white-space: pre; color: ${fg};
    }

    /* Stats */
    .stats {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px; margin-top: 12px;
    }
    .stat-card {
      background: ${isDark ? "#2d2d2d" : "#f5f5f5"};
      border: 1px solid ${borderColor}; border-radius: 6px;
      padding: 10px; text-align: center;
    }
    .stat-value { font-size: 20px; font-weight: 700; color: #0078d4; }
    .stat-label { font-size: 11px; color: ${subtleColor}; margin-top: 2px; }

    .error { color: #f48771; padding: 12px; }
    .badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 600;
    }
    .badge-success { background: rgba(16,124,16,0.15); color: #107c10; }
    .badge-error { background: rgba(209,52,56,0.15); color: #d13438; }
    .badge-warning { background: rgba(255,140,0,0.15); color: #ff8c00; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">Adaptive Card Preview</span>
    <button class="toolbar-btn" onclick="copyJson()">Copy JSON</button>
    <button class="toolbar-btn primary" onclick="openDesigner()">Open in Designer</button>
  </div>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('preview')">Preview</button>
    <button class="tab" onclick="switchTab('json')">JSON</button>
    <button class="tab" onclick="switchTab('info')">Info</button>
  </div>

  <div class="content">
    <div id="tab-preview" class="tab-content active">
      <div class="host-bar">
        <span>Simulating:</span>
        <select id="host-select" onchange="rerender()">
          <option value="teams-light">Teams (Light)</option>
          <option value="teams-dark">Teams (Dark)</option>
          <option value="outlook">Outlook</option>
          <option value="default">Default</option>
        </select>
      </div>
      <div id="card-container"></div>
    </div>
    <div id="tab-json" class="tab-content">
      <pre id="json-output"></pre>
    </div>
    <div id="tab-info" class="tab-content">
      <div id="info-content"></div>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const cardPayload = ${escapedJson};

    // Tab switching
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector('.tab-content#tab-' + tab).classList.add('active');
      event.target.classList.add('active');
    }

    // Render card
    const hostConfigs = {
      'teams-light': {
        fontFamily: "'Segoe UI', sans-serif",
        containerStyles: {
          default: { backgroundColor: "#ffffff",
            foregroundColors: { default: {default:"#333"}, accent: {default:"#0078d4"}, good: {default:"#107c10"}, attention: {default:"#d13438"}, warning: {default:"#ff8c00"} }
          },
          emphasis: { backgroundColor: "#f0f0f0" }
        }
      },
      'teams-dark': {
        fontFamily: "'Segoe UI', sans-serif",
        containerStyles: {
          default: { backgroundColor: "#2d2d2d",
            foregroundColors: { default: {default:"#e0e0e0"}, accent: {default:"#6cb6ff"}, good: {default:"#4ec94e"}, attention: {default:"#f48771"}, warning: {default:"#ff8c00"} }
          },
          emphasis: { backgroundColor: "#383838" }
        }
      },
      'outlook': {
        fontFamily: "'Segoe UI', sans-serif",
        containerStyles: {
          default: { backgroundColor: "#ffffff",
            foregroundColors: { default: {default:"#333"}, accent: {default:"#0078d4"}, good: {default:"#107c10"}, attention: {default:"#d13438"}, warning: {default:"#ff8c00"} }
          },
          emphasis: { backgroundColor: "#f4f4f4" }
        }
      },
      'default': {
        containerStyles: {
          default: { backgroundColor: "${cardBg}",
            foregroundColors: { default: {default:"${fg}"}, accent: {default:"#0078d4"}, good: {default:"#107c10"}, attention: {default:"#d13438"}, warning: {default:"#ff8c00"} }
          },
          emphasis: { backgroundColor: "${emphasisBg}" }
        }
      }
    };

    function rerender() {
      const container = document.getElementById('card-container');
      container.innerHTML = '';
      const host = document.getElementById('host-select').value;
      try {
        const ac = new AdaptiveCards.AdaptiveCard();
        ac.hostConfig = new AdaptiveCards.HostConfig(hostConfigs[host] || hostConfigs['default']);
        ac.parse(cardPayload);
        const rendered = ac.render();
        if (rendered) { container.appendChild(rendered); }
        else { container.innerHTML = '<div class="error">Failed to render</div>'; }
      } catch(e) {
        container.innerHTML = '<div class="error">Render error: ' + e.message + '</div>';
      }
    }

    // JSON tab
    document.getElementById('json-output').textContent = JSON.stringify(cardPayload, null, 2);

    // Info tab
    function buildInfo() {
      const body = cardPayload.body || [];
      const actions = cardPayload.actions || [];
      const types = new Set();
      const actionTypes = new Set();
      let elementCount = 0, inputCount = 0, imageCount = 0;
      function walk(elements) {
        if (!Array.isArray(elements)) return;
        for (const el of elements) {
          if (!el || !el.type) continue;
          elementCount++; types.add(el.type);
          if (el.type.startsWith('Input.')) inputCount++;
          if (el.type === 'Image') imageCount++;
          if (el.items) walk(el.items);
          if (el.columns) el.columns.forEach(c => { if(c.items) walk(c.items); });
          if (el.rows) el.rows.forEach(r => { if(r.cells) r.cells.forEach(c => { if(c.items) walk(c.items); }); });
        }
      }
      walk(body);
      actions.forEach(a => { if(a.type) actionTypes.add(a.type); });

      const hasSpeak = !!cardPayload.speak;
      const version = cardPayload.version || 'unknown';

      document.getElementById('info-content').innerHTML = \`
        <div class="stats">
          <div class="stat-card"><div class="stat-value">\${elementCount}</div><div class="stat-label">Elements</div></div>
          <div class="stat-card"><div class="stat-value">\${inputCount}</div><div class="stat-label">Inputs</div></div>
          <div class="stat-card"><div class="stat-value">\${imageCount}</div><div class="stat-label">Images</div></div>
          <div class="stat-card"><div class="stat-value">\${actions.length}</div><div class="stat-label">Actions</div></div>
          <div class="stat-card"><div class="stat-value">\${version}</div><div class="stat-label">Version</div></div>
          <div class="stat-card"><div class="stat-value">\${hasSpeak ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-warning">No</span>'}</div><div class="stat-label">Speak</div></div>
        </div>
        <h4 style="margin: 16px 0 8px; font-size: 12px; color: ${subtleColor}; text-transform: uppercase;">Element Types</h4>
        <p style="font-size: 13px;">\${[...types].sort().map(t => '<code>' + t + '</code>').join(', ') || 'None'}</p>
        <h4 style="margin: 16px 0 8px; font-size: 12px; color: ${subtleColor}; text-transform: uppercase;">Action Types</h4>
        <p style="font-size: 13px;">\${[...actionTypes].sort().map(t => '<code>' + t + '</code>').join(', ') || 'None'}</p>
      \`;
    }

    // Actions
    function copyJson() { vscode.postMessage({ command: 'copyJson' }); }
    function openDesigner() { vscode.postMessage({ command: 'openDesigner' }); }

    // Initial render
    const preferDark = ${isDark};
    if (preferDark) document.getElementById('host-select').value = 'teams-dark';
    rerender();
    buildInfo();
  </script>
</body>
</html>`;
  }
}
