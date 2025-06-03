import { GeodeCLI } from "../../../project/GeodeCLI";
import { Resources } from "../../Package";
import { LoadingCircle } from "../../widgets/Basic";
import { Button, IconButton } from "../../widgets/Button";
import { Row } from "../../widgets/Container";
import { Head, IconText } from "../../widgets/Text";
import { ClientWidget } from "./ClientWidget";
import { Codicon } from "../../widgets/types/Icon";
import { getWorkspaceDir } from "../../../config";

export class ProjectWidget extends ClientWidget {

    public static readonly RESOURCES = Resources.fromCSS(`
        #project-check-text .codicon-ellipsis {
            color: var(--vscode-editorWarning-foreground);
        }

        #project-check-text .codicon-error {
            color: var(--vscode-editorError-foreground);
        }

        #project-check-text .codicon-check {
            color: #69CC00;
        }
    `);

    private static readonly SUCCESS_ICON: Codicon = "check";

    private static readonly ERROR_ICON: Codicon = "error";

    private readonly checkText: IconText;

    constructor() {
        super();

        this.checkText = new IconText({
            id: "project-check-text",
            suffixText: "",
            icon: "question"
        });

        this.addChild(
            new Head({
                size: 2,
                text: "Project"
            }),
            new Row().addChild(
                new Button({
                    title: "Clear Cache",
                    start: "trash",
                    onClick: (button) => this.clickButton(
                        button,
                        () => GeodeCLI.get()!.run("project clear-cache", getWorkspaceDir()),
                        (result) => result.isValue() ? ProjectWidget.SUCCESS_ICON : ProjectWidget.ERROR_ICON
                    )
                }),
                new IconButton({
                    appearance: "primary",
                    content: "question",
                    onClick: (button) => this.checkProject(button)
                }).click(),
                this.checkText
            )
        );
    }

    private checkProject(button: IconButton): void {
        const activeDir = getWorkspaceDir();

        if (activeDir) {
            this.checkText.setIcon("ellipsis");
            this.checkText.setSuffixText("Checking project");

            button.setContent(new LoadingCircle({
                color: "var(--vscode-button-foreground)"
            }));
        } else {
            this.checkText.setIcon(ProjectWidget.ERROR_ICON);
            this.checkText.setSuffixText("No active project found");

            button.setContent("refresh");

            return;
        }

        GeodeCLI.get()!.run("project check", activeDir).then((result) => {
            if (result.isValue()) {
                this.checkText.setIcon(ProjectWidget.SUCCESS_ICON);
                this.checkText.setSuffixText("Project check passed");
            } else {
                this.checkText.setIcon(ProjectWidget.ERROR_ICON);
                this.checkText.setSuffixText("Project check failed: " + result.unwrapErr());
            }

            button.setContent("refresh");
        });
    }
}