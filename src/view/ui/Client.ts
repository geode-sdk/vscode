import { ViewProvider } from "../ViewProvider";
import { Column } from "../widgets/Container";
import { SizeUnit } from "../widgets/types/Size";
import { ProfileWidget } from "./specific/ProfileWidget";
import { StatsWidget } from "./specific/StatsWidget";

export class Client extends ViewProvider {

    constructor() {
        super();

        this.addChild(new Column({
            spacing: {
                amount: 2,
                unit: SizeUnit.REM
            }
        }).addChild(
            new StatsWidget(),
            new ProfileWidget()
        ));
    }
}