import { ViewProvider } from "../ViewProvider";
import { Column } from "../widgets/Container";
import { SizeUnit } from "../widgets/types/Size";
import { ProfileWidget } from "./specific/ProfileWidget";
import { ProjectWidget } from "./specific/ProjectWidget";
import { ToolsWidget } from "./specific/ToolsWidget";

export class Client extends ViewProvider {

    constructor() {
        super();

        this.addChild(new Column({
            spacing: {
                amount: 1,
                unit: SizeUnit.REM
            }
        }).addChild(
            new ToolsWidget(),
            new ProfileWidget(),
            new ProjectWidget()
        ));
    }
}