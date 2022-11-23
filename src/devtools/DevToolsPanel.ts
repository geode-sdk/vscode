
import { ViewColumn, window } from "vscode";
import { DataGrid, DataGridCell, DataGridRow, Head, Label, Separator, Text } from "../widgets/Basic";
import { Column, PaddedDiv, Row } from "../widgets/Container";
import { Button, Tabs } from "../widgets/Interactive";
import { Panel, ScriptPackage } from "../widgets/Widget";
import * as geode from '../geode/geode';
import { RTModJson } from "../project/mod";

export class DevToolsPanel extends Panel {
    static #current?: DevToolsPanel;

    static scripts: ScriptPackage = {
        id: 'DevToolsPanel',
        css: /*css*/ `
            body {
                padding: 1rem;
            }
        `
    };

    private constructor() {
        super({
            id: 'geode.dev-tools',
            title: 'Geode Dev Tools',
            lightIcon: 'blockman-light.svg',
            darkIcon: 'blockman-dark.svg',
            scripts: [
                DevToolsPanel.scripts,
                Head.scripts,
                Label.scripts,
                Text.scripts,
                Button.scripts,
                Row.scripts,
                Column.scripts,
                DataGrid.scripts,
                Tabs.scripts,
                Separator.scripts,
                PaddedDiv.scripts,
            ]
        });

        this.add(new Column()
            .add(new Row()
                .add(new Button('Send Test Message', {
                    onClick: _ => {
                        geode.ipc.post('geode.loader', 'ipc-test')
                            .then(res => {
                                window.showInformationMessage(
                                    `Received ipc-test response: ${res}`
                                );
                            })
                            .catch(err => {
                                window.showErrorMessage(err);
                            });
                    }
                }))
            )
            .add(new Head('Todo'))
        );
    }

    protected onDispose(): void {
        DevToolsPanel.#current = undefined;
    }

    static show() {
        if (!DevToolsPanel.#current) {
            DevToolsPanel.#current = new DevToolsPanel();
        }
        DevToolsPanel.#current.show(ViewColumn.Beside);
    }
}
