import { ViewColumn } from "vscode";
import { Panel, ScriptPackage } from "../widgets/Widget";
import { scripts } from "../widgets/Scripts";
import { IFrame } from "../widgets/Interactive";

export class DocsBrowserPaenl extends Panel {

    private static instance?: DocsBrowserPaenl;

    private static readonly scripts: ScriptPackage = {
        id: "DocsBrowserPaenl",
        css: /*css*/ `
            :root {
                --item-width:   minmax(11rem, 1fr);
                --item-height:  13rem;
            }
            
            html {
                height: 100%;
            }

            body {
                display: flex;
                align-items: stretch;
                flex-direction: column;
                height: 100%;
            }

            iframe {
                width: 100%;
                height: 100%;
                border: none;
            }
        `
    };

    public static show() {
        if (!DocsBrowserPaenl.instance) {
            DocsBrowserPaenl.instance = new DocsBrowserPaenl();
        }

        DocsBrowserPaenl.instance.show(ViewColumn.Beside);
	}

    protected onDispose(): void {
		DocsBrowserPaenl.instance = undefined;
	}

    private constructor() {
        super({
			id: "geode.doc-browser",
			title: "Doc Browser",
			lightIcon: "blockman-light.svg",
			darkIcon: "blockman-dark.svg",
			scripts: [
                DocsBrowserPaenl.scripts,
                IFrame.scripts,
				scripts.observer,
			]
		});

        this.add(new IFrame({
            src: "https://docs.geode-sdk.org"
        }));
    }
}