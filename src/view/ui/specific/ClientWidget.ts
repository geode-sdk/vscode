import { Config, GeodeCLI } from "../../../project/GeodeCLI";
import { GetWidgetProperties } from "../../Widget";
import { Column } from "../../widgets/Container";

export abstract class ClientWidget extends Column {

    private configChangeWatchID?: number;

    constructor(properties?: GetWidgetProperties<typeof Column>) {
        super(properties);
    }

    public override onShow(): void {
        const cli = GeodeCLI.get()!;

        this.configChangeWatchID = cli.onUpdateEvent((config) => this.updateContents(config));

        this.updateContents(cli.getConfig());
    }

    public override onHide(): void {
        if (this.configChangeWatchID) {
            GeodeCLI.get()?.removeUpdateWatch(this.configChangeWatchID);

            this.configChangeWatchID = undefined;
        }
    }

    protected abstract updateContents(config: Config): void;
}