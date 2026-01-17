import { App, PluginSettingTab, Setting } from "obsidian";
import type ClipboardManagerPlugin from "./main";

export class ClipboardManagerSettingTab extends PluginSettingTab {
	plugin: ClipboardManagerPlugin;

	constructor(app: App, plugin: ClipboardManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("System clipboard").setHeading();

		new Setting(containerEl)
			.setName("Track system clipboard")
			.setDesc("Monitor the system-wide clipboard for changes outside of Obsidian")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.trackSystemClipboard)
					.onChange(async (value) => {
						this.plugin.settings.trackSystemClipboard = value;
						if (value) {
							this.plugin.startClipboardMonitor();
						} else {
							this.plugin.stopClipboardMonitor();
						}
						await this.plugin.saveSettings();
						this.display(); // Refresh settings UI to show/hide sub-settings
					})
			);

		if (this.plugin.settings.trackSystemClipboard) {
			new Setting(containerEl)
				.setName("Pin system clipboard")
				.setDesc("Always show the current system clipboard entry at the top of the list")
				.addToggle((toggle) =>
					toggle
						.setValue(this.plugin.settings.pinSystemClipboard)
						.onChange(async (value) => {
							this.plugin.settings.pinSystemClipboard = value;
							await this.plugin.saveSettings();
							this.plugin.refreshViews();
						})
				);

			new Setting(containerEl)
				.setName("Polling interval")
				.setDesc(
					"How often to check the clipboard for changes in milliseconds (100-10000)"
				)
				.addText((text) =>
					text
						.setPlaceholder("1000")
						.setValue(String(this.plugin.settings.pollingInterval))
						.onChange(async (value) => {
							const num = parseInt(value, 10);
							if (!isNaN(num) && num >= 100 && num <= 10000) {
								this.plugin.settings.pollingInterval = num;
								await this.plugin.saveSettings();
								this.plugin.restartClipboardMonitor();
							}
						})
				);
		}

		new Setting(containerEl).setName("History").setHeading();

		new Setting(containerEl)
			.setName("History limit")
			.setDesc("Maximum number of clipboard entries to store (1-5000)")
			.addText((text) =>
				text
					.setPlaceholder("500")
					.setValue(String(this.plugin.settings.historyLimit))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 1 && num <= 5000) {
							this.plugin.settings.historyLimit = num;
							await this.plugin.saveSettings();
							this.plugin.trimHistory();
						}
					})
			);

		new Setting(containerEl)
			.setName("Allow duplicates")
			.setDesc("If disabled, copying the same text will move the existing entry to the top instead of creating a new one")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.allowDuplicates)
					.onChange(async (value) => {
						this.plugin.settings.allowDuplicates = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ignore whitespace-only")
			.setDesc("Do not capture clipboard entries that only contain spaces, tabs, or line breaks")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.ignoreWhitespaceOnly)
					.onChange(async (value) => {
						this.plugin.settings.ignoreWhitespaceOnly = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Auto-delete after paste")
			.setDesc(
				"Automatically remove an entry from history after pasting it via the quick switcher"
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoDeleteAfterPaste)
					.onChange(async (value) => {
						this.plugin.settings.autoDeleteAfterPaste = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Ribbon button action")
			.setDesc("What the ribbon icon should open when clicked")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("fullView", "Full history view")
					.addOption("sidebar", "Sidebar")
					.setValue(this.plugin.settings.ribbonAction)
					.onChange(async (value) => {
						this.plugin.settings.ribbonAction = value as "sidebar" | "fullView";
						await this.plugin.saveSettings();
					})
			);
	}
}
