import * as uri from "vscode-uri";
import * as vscode from "vscode";
import { Uri as LixUri } from "../compiler/uri";

export class VSCodeUri implements LixUri {

    constructor(private vscodeUri: vscode.Uri) {
    }

    get scheme(): string {
        return this.vscodeUri.scheme;
    }

    get authority(): string {
        return this.vscodeUri.authority;
    }

    get path(): string {
        return this.vscodeUri.path;
    }

    get query(): string {
        return this.vscodeUri.query;
    }

    get fragment(): string {
        return this.vscodeUri.fragment;
    }

    get fsPath(): string {
        return this.vscodeUri.fsPath;
    }

    with(change: { scheme?: string; authority?: string; path?: string; query?: string; fragment?: string; }): VSCodeUri {
        return new VSCodeUri(this.vscodeUri.with(change));
    }

    joinPath(...paths: string[]): VSCodeUri {
        return new VSCodeUri(vscode.Uri.joinPath(this.vscodeUri, ...paths));
    }

    resolvePath(...paths: string[]): VSCodeUri {
        return new VSCodeUri(uri.Utils.resolvePath(this.vscodeUri, ...paths));
    }

    get dirname(): VSCodeUri {
        return new VSCodeUri(uri.Utils.dirname(this.vscodeUri));
    }

    get basename(): string {
        return uri.Utils.basename(this.vscodeUri);
    }

    get extname(): string {
        return uri.Utils.extname(this.vscodeUri);
    }

    get stem(): string {
        return this.basename.slice(0, -this.extname.length);
    }

    equals(other: LixUri): boolean {
        return this.scheme === other.scheme &&
            this.authority === other.authority &&
            this.path === other.path &&
            this.query === other.query &&
            this.fragment === other.fragment;
    }

    toString(skipEncoding?: boolean): string {
        return this.vscodeUri.toString(skipEncoding);
    }

    toJSON() {
        return this.vscodeUri.toJSON();
    }

}