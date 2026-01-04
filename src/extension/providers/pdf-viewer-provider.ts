import * as vscode from 'vscode';
import { TextDecoder } from 'util';
import * as path from 'path';
import { Utils } from 'vscode-uri';

/**
 * Custom read-only editor provider for PDF files using pdf.js viewer.
 * Mirrors the approach of vscode-pdf but keeps the implementation minimal.
 */
export class PdfViewerProvider implements vscode.CustomReadonlyEditorProvider {
    public static readonly viewType = 'lix.pdfViewer';

    private rawHtml: string;
    private watchers: Map<string, vscode.FileSystemWatcher>;

    constructor(private readonly extensionDir: vscode.Uri) {
        this.rawHtml = "";
        this.watchers = new Map();
    }

    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        return { uri, dispose: () => { } };
    }

    async init() {
        const pdfjsDir = vscode.Uri.joinPath(this.extensionDir, 'assets', 'pdf.js');
        const htmlUrl = vscode.Uri.joinPath(pdfjsDir, 'web', 'viewer.html');
        const raw = await vscode.workspace.fs.readFile(htmlUrl);
        const decoder = new TextDecoder();
        this.rawHtml = decoder.decode(raw);
    }

    async resolveCustomEditor(document: vscode.CustomDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionDir, 'assets', 'pdf.js'),
                vscode.Uri.joinPath(document.uri, "..")
            ]
        };
        webviewPanel.webview.html = this.getHtml(webviewPanel.webview, document.uri);
        this.watch(document.uri, webviewPanel.webview);
        webviewPanel.onDidDispose(() => this.unwatch(document.uri));
    }

    private getHtml(webview: vscode.Webview, pdfFileUri: vscode.Uri): string {
        const pdfjsDir = vscode.Uri.joinPath(this.extensionDir, 'assets', 'pdf.js');
        const rewriteUri = (url: string) =>
            webview.asWebviewUri(vscode.Uri.joinPath(pdfjsDir, url)).toString();

        const pdfSrc = webview.asWebviewUri(pdfFileUri).toString();

        const inject = `
<style>
  html,
  body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
</style>
<script type="module">
  console.log("${rewriteUri('/build/pdf.worker.mjs')}");
  console.log("${rewriteUri('build/pdf.mjs')}");

  const { GlobalWorkerOptions } = window.pdfjsLib;
  //GlobalWorkerOptions.workerSrc = "${rewriteUri('/build/pdf.worker.mjs')}";
  const { PDFViewerApplication, PDFViewerApplicationOptions } = window;
  PDFViewerApplicationOptions.set("defaultUrl", "");
  //PDFViewerApplicationOptions.set("workerSrc", "${rewriteUri('/build/pdf.worker.mjs')}");
  PDFViewerApplicationOptions.set("debuggerSrc", "${rewriteUri('/web/debugger.mjs')}");
  PDFViewerApplicationOptions.set("sandboxBundleSrc", "${rewriteUri('/build/pdf.sandbox.mjs')}");
  PDFViewerApplicationOptions.set("imageResourcesPath", "${rewriteUri('/web/images/')}");
  PDFViewerApplicationOptions.set("cMapUrl", "${rewriteUri('/web/cmaps/')}");
  PDFViewerApplicationOptions.set("iccUrl", "${rewriteUri('/web/iccs/')}");
  PDFViewerApplicationOptions.set("standardFontDataUrl", "${rewriteUri('/web/standard_fonts/')}");
  PDFViewerApplicationOptions.set("wasmUrl", "${rewriteUri('/web/wasm/')}");
  await PDFViewerApplication?.initializedPromise;
  await PDFViewerApplication?.open({ url: "${pdfSrc}" });

  window.addEventListener("message", async (event) => {
    await window.PDFViewerApplication.initializedPromise;
    const currentPageNumber = PDFViewerApplication.pdfViewer.currentPageNumber;
    if (event.data?.action === "reload") {
      await PDFViewerApplication.open({ url: event.data.url });
      await PDFViewerApplication.pdfViewer.pagesPromise;
      PDFViewerApplication.pdfViewer.currentPageNumber = Math.min(
        currentPageNumber,
        PDFViewerApplication.pdfViewer.pagesCount
      );
    }
  });
</script>`;

        const html = this.rawHtml
            .replace(`<title>PDF.js viewer</title>`, `<title>PDF.js viewer</title>\n`)
            .replace(`"locale/locale.json"`, `"${rewriteUri('web/locale/locale.json')}"`)
            .replace(`"../build/pdf.mjs"`, `"${rewriteUri('build/pdf.mjs')}"`)
            .replace(`"viewer.mjs"`, `"${rewriteUri('web/viewer.mjs')}"`)
            .replace(`"viewer.css"`, `"${rewriteUri('web/viewer.css')}"`)
            .replace(`</head>`, `${inject}\n</head>`);
        return html;
    }

    private watch(uri: vscode.Uri, webview: vscode.Webview) {
        const key = uri.toString();
        if (this.watchers.has(key)) {
            return;
        }
        const dir = vscode.Uri.joinPath(uri, "..");
        const pattern = new vscode.RelativePattern(dir, Utils.basename(uri));
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        const postReload = () => webview.postMessage({ action: "reload", url: webview.asWebviewUri(uri).toString() });
        watcher.onDidChange(postReload);
        watcher.onDidCreate(postReload);
        watcher.onDidDelete(postReload);
        this.watchers.set(key, watcher);
    }

    private unwatch(uri: vscode.Uri) {
        const key = uri.toString();
        const watcher = this.watchers.get(key);
        if (watcher) {
            watcher.dispose();
            this.watchers.delete(key);
        }
    }
}
