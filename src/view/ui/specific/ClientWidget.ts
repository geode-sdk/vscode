import { Config, GeodeCLI } from "../../../project/GeodeCLI";
import { GetWidgetProperties } from "../../Widget";
import { LoadingCircle } from "../../widgets/Basic";
import { Column } from "../../widgets/Container";
import { Future, Result } from "../../../utils/monads";
import { Button, IconButton, SlotType } from "../../widgets/Button";

export abstract class ClientWidget extends Column {

    private configChangeWatchID?: number;

    constructor(properties?: GetWidgetProperties<typeof Column>) {
        super(properties);
    }

    public override onShow(): void {
        if (this.updateContents) {
            const cli = GeodeCLI.get()!;

            this.configChangeWatchID = cli.onUpdateEvent((config) => this.updateContents?.(config));

            this.updateContents(cli.getConfig());
        }
    }

    public override onHide(): void {
        if (this.configChangeWatchID) {
            GeodeCLI.get()?.removeUpdateWatch(this.configChangeWatchID);

            this.configChangeWatchID = undefined;
        }
    }

    protected updateContents?(config: Config): void;

    protected clickButton<T>(button: Button | IconButton, callback: () => Future<T>, postCallback?: (result: Result<T>) => SlotType | void): void {
        const loadingCircle = new LoadingCircle({
            color: "var(--button-primary-foreground)"
        });

        if (button instanceof Button) {
            callback().then((result) => {
                const postResult = postCallback?.(result);

                if (postResult) {
                    button.setEnd(postResult);

                    setTimeout(() => button.removeEnd(), 2_000);
                } else {
                    button.removeEnd();
                }
            });

            button.setEnd(loadingCircle);
        } else {
            const oldContent = button.getContent();

            callback().then((result) => button.setContent(postCallback?.(result) ?? oldContent));

            button.setContent(loadingCircle);
        }
    }
}