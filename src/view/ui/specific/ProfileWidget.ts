import { Config, GeodeCLI, Profile } from "../../../project/GeodeCLI";
import { Resources } from "../../Package";
import { IconButton } from "../../widgets/Button";
import { Column, Row, Spacer } from "../../widgets/Container";
import { Input, Select } from "../../widgets/Interactive";
import { Head, Label } from "../../widgets/Text";
import { SizeUnit } from "../../widgets/types/Size";
import { ClientWidget } from "./ClientWidget";

export class ProfileWidget extends ClientWidget {

    public static readonly RESOURCES = Resources.fromResources({
        css: `
            .profile-path {
                width: 100%;
            }

            #path {
                width: 100%;
            }
        `,
        js: `
            onGlobalClick((event) => post("reset-clicks", {
                widgetID: getWidgetIDRecursive(event.target)
            }));
        `
    });

    private readonly profileSelection: Select;

    private readonly profilePath: Input;

    private readonly profileDeleteButton: IconButton;

    private readonly profileLaunchButton: IconButton;

    private terminaleWatchID?: number;

    constructor() {
        const cli = GeodeCLI.get()!;
        const config = cli.getConfig();

        super();

        this.addChild(
            new Row().addChild(
                new Head({ size: 3, text: "Profiles" }),
                new IconButton({
                    icon: "plus",
                    hoverText: "Add",
                    appearance: "primary",
                    onClick: () => 0
                })
            ),
            new Row().addChild(
                new Column().addChild(
                    new Label({ for: "profiles", text: "Select a profile" }),
                    this.profileSelection = new Select({
                        id: "profiles",
                        selected: config.currentProfile,
                        items: [],
                        hoverText: "Select a profile",
                        onChange: (value) => cli.setCurrentProfile(value).map((profile) => this.updateProfilePath(profile.getExecutablePath()))
                    })
                ),
                new Column({
                    className: "profile-path"
                }).addChild(
                    new Label({ for: "path", text: "Path" }),
                    this.profilePath = new Input({
                        id: "path",
                        placeholder: "Path to the profile",
                        disabled: true
                    })
                ),
                new Column().addChild(
                    new Spacer({
                        height: {
                            amount: 1,
                            unit: SizeUnit.REM
                        }
                    }),
                    new Row().addChild(
                        this.profileDeleteButton = new IconButton({
                            icon: "question",
                            appearance: "secondary",
                            onClick: () => {
                                if (this.profileDeleteButton.getIcon() == "trashcan") {
                                    this.profileDeleteButton.setIcon("error");
                                    this.profileDeleteButton.setHoverText("Confirm removal");
                                } else {
                                    this.executeIfSelected((profile) => cli.removeProfile(profile));
                                    this.resetProfileDeleteButton();
                                }
                            }
                        }),
                        this.profileLaunchButton = new IconButton({
                            icon: "question",
                            hoverText: "Launch",
                            appearance: "secondary",
                            onClick: () => {
                                if (this.profileLaunchButton.getIcon() == "debug-stop") {
                                    cli.destroyTerminal();
                                } else {
                                    this.executeIfSelected((profile) => cli.launchProfile(profile));
                                }
                            }
                        })
                    )
                )
            )
        );

        this.resetProfileDeleteButton();
        this.updateLaunchButtonState(cli.hasActiveTerminal());
        this.registerHandler<{ widgetID: string }>("reset-clicks", ({ widgetID }) => {
            if (widgetID != this.profileDeleteButton.getWidgetID()) {
                this.resetProfileDeleteButton();
            }
        });
    }

    public override onShow(): void {
        this.terminaleWatchID = GeodeCLI.get()?.onTerminalEvent((terminal) => this.updateLaunchButtonState(terminal != undefined));

        super.onShow();
    }

    public override onHide(): void {
        if (this.terminaleWatchID) {
            GeodeCLI.get()?.removeTerminalWatch(this.terminaleWatchID);
        }

        super.onHide();
    }

    protected override updateContents(config: Config): void {
        const profileNames = config.profiles.map((profile) => profile.getName());
        const selectionProfiles = this.profileSelection.getItems();

        if (config.profiles.length != selectionProfiles.length || profileNames.some((profile, index) => selectionProfiles[index].name != profile)) {
            this.updateProfileItems(config.currentProfile, config.profiles);
        }

        if (config.profiles.length) {
            let selected = this.profileSelection.getSelected();

            this.profileSelection.setDisabled(false);
            this.profileDeleteButton.setDisabled(false);
            this.profileLaunchButton.setDisabled(false);

            if (config.currentProfile != selected) {
                selected = profileNames.some((profile) => config.currentProfile == profile) ? config.currentProfile : selected;

                this.updateProfileSelection(selected);
            }

            const profilePath = config.profiles.find((profile) => profile.getName() == selected)?.getExecutablePath() ?? "";

            if (profilePath != this.profilePath.getValue()) {
                this.updateProfilePath(profilePath);
            }
        } else {
            this.profileSelection.setSelected(undefined);
            this.profilePath.setValue("");
            this.profilePath.setHoverText("");
            this.profileSelection.setDisabled(true);
            this.profileDeleteButton.setDisabled(true);
            this.profileLaunchButton.setDisabled(true);
        }
    }

    private executeIfSelected(callback: (profile: string) => any): void {
        const selected = this.profileSelection.getSelected();

        if (selected) {
            callback(selected);
        }
    }

    private updateProfileItems(active: string, profiles: Profile[]): void {
        this.profileSelection.setItems(profiles.map((profile) => profile.getName()));
        const selected = this.profileSelection.getSelected();

        if (selected && selected != active) {
            GeodeCLI.get()?.setCurrentProfile(selected);
        }
    }

    private updateProfileSelection(profile?: string): void {
        this.profileSelection.setSelected(profile);
    }

    private updateProfilePath(path: string): void {
        this.profilePath.setValue(path);
        this.profilePath.setHoverText(path);
    }

    private updateLaunchButtonState(state: boolean): void {
        if (state) {
            this.profileLaunchButton.setIcon("debug-stop");
            this.profileLaunchButton.setHoverText("Stop");
        } else {
            this.profileLaunchButton.setIcon("debug-start");
            this.profileLaunchButton.setHoverText("Launch");
        }
    }

    private resetProfileDeleteButton(): void {
        this.profileDeleteButton.setIcon("trashcan");
        this.profileDeleteButton.setHoverText("Remove");
    }
}