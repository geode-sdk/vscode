import { ViewColumn } from "vscode";
import { Panel, ScriptPackage } from "../widgets/Widget";
import { scripts } from "../widgets/Scripts";
import { IFrame } from "../widgets/Interactive";

export class DocsBrowserPanel extends Panel {

    private static instance?: DocsBrowserPanel;

    private static readonly scripts: ScriptPackage = {
        id: "DocsBrowserPanel",
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
        if (!DocsBrowserPanel.instance) {
            DocsBrowserPanel.instance = new DocsBrowserPanel();
        }

        DocsBrowserPanel.instance.show(ViewColumn.Beside);
	}

    protected onDispose(): void {
		DocsBrowserPanel.instance = undefined;
	}

    private constructor() {
        super({
			id: "geode.doc-browser",
			title: "Doc Browser",
			lightIcon: "blockman-light.svg",
			darkIcon: "blockman-dark.svg",
			scripts: [
                DocsBrowserPanel.scripts,
                IFrame.scripts,
				scripts.observer,
			]
		});

        this.add(new IFrame({
            src: "https://docs.geode-sdk.org"
        }));
    }
}