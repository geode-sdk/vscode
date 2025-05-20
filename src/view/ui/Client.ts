import { ViewProvider } from "../ViewProvider";
import { Column } from "../widgets/Container";
import { ProfileWidget } from "./specific/ProfileWidget";
import { StatsWidget } from "./specific/StatsWidget";

export class Client extends ViewProvider {

    constructor() {
        super();

        this.addChild(new Column().addChild(
            new StatsWidget(),
            new ProfileWidget()
        ));
    }
}