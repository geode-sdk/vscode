import { Config, GeodeCLI } from "../../../project/GeodeCLI";
import { Future } from "../../../utils/monads";
import { LoadingCircle } from "../../widgets/Basic";
import { Button } from "../../widgets/Button";
import { Row } from "../../widgets/Container";
import { Head } from "../../widgets/Text";
import { ClientWidget } from "./ClientWidget";

export class StatsWidget extends ClientWidget {

    private readonly title: Head;

    private readonly buildTypeButton: Button;

    constructor() {
        const cli = GeodeCLI.get()!;

        super();

        this.addChild(
            this.title = new Head({
                size: 2,
                text: ""
            }),
            new Row().addChild(
                this.buildTypeButton = new Button({
                    title: "",
                    start: "question",
                    onClick: (button) => this.clickButton(button, () => cli.updateSDK(!cli.getConfig().sdkNightly))
                }),
                new Button({
                    title: "Update SDK",
                    start: "cloud-download",
                    onClick: (button) => this.clickButton(button, () => cli.updateSDK(cli.getConfig().sdkNightly))
                }),
                new Button({
                    title: "Install Binaries",
                    start: "cloud-download",
                    onClick: (button) => this.clickButton(button, () => cli.installBinaries())
                })
            )
        );
    }

    protected override updateContents(config: Config): void {
        this.updateTitle(config);
        this.updateBuildType();
    }

    private updateTitle(config: Config): void {
        const cli = GeodeCLI.get()!;
        const sdkVersion = cli.getSDKVersion();
        const titleParts = [
            `Geode CLI v${cli.getVersion()}`
        ];

        if (sdkVersion.isValue()) {
            titleParts.push(`SDK v${sdkVersion.unwrap()} (${config.sdkNightly ? "Nightly" : "Stable"})`);
        }

        if (config.defaultDeveloperName) {
            titleParts.push(`User ${config.defaultDeveloperName}`);
        }

        this.title.setText(titleParts.join(" - "));
    }

    private updateBuildType(): void {
        if (GeodeCLI.get()?.getConfig().sdkNightly) {
            this.buildTypeButton.setTitle("Install Stable");
            this.buildTypeButton.setStart("beaker-stop");
        } else {
            this.buildTypeButton.setTitle("Install Nightly");
            this.buildTypeButton.setStart("beaker");
        }
    }

    private clickButton(button: Button, callback: () => Future): void {
        button.setEnd(new LoadingCircle({
            color: "var(--button-primary-foreground)",
            style: {
                width: "1rem",
                height: "1rem",
                "margin-left": "0.5rem"
            }
        }));

        callback().finally(() => button.removeEnd());
    }
}