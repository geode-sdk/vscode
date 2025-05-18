import { Resources } from "../Package";
import { ViewProvider } from "../ViewProvider";
import { IFrame } from "../widgets/Interactive";

export class DocsBrowser extends ViewProvider {

    public static readonly RESOURCES = Resources.fromCSS(`
        #docs-frame {
            margin-top: .5rem;
            width: 100%;
            height: 100%;
            border: none;
        }
    `);

    constructor() {
        super();

        this.addChild(new IFrame({
            id: "docs-frame",
            src: "https://docs.geode-sdk.org"
        }));
    }
}