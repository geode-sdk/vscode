import { Config, GeodeCLI } from "../../../project/GeodeCLI";
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
                    startIcon: "question",
                    onClick: () => cli.toggleNightly()
                }),
                new Button({
                    title: "Update SDK",
                    startIcon: "cloud-download"
                }),
                new Button({
                    title: "Install Binaries",
                    startIcon: "cloud-download"
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
            this.buildTypeButton.setTitle("Switch to Stable SDK");
            this.buildTypeButton.setStartIcon("beaker-stop");
        } else {
            this.buildTypeButton.setTitle("Switch to Nightly SDK");
            this.buildTypeButton.setStartIcon("beaker");
        }
    }
}