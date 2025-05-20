import { Config, GeodeCLI } from "../../../project/GeodeCLI";
import { Head } from "../../widgets/Text";
import { ClientWidget } from "./ClientWidget";

export class StatsWidget extends ClientWidget {

    private readonly header: Head;

    constructor() {
        super();

        this.addChild(
            this.header = new Head({
                size: 2,
                text: ""
            })
        );
    }

    protected override updateContents(config: Config): void {
        this.header.setText(`Geode CLI v${GeodeCLI.get()!.getVersion()} - User ${config.defaultDeveloperName || "Unknown"}`);
    }
}