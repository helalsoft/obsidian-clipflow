export interface ClipboardEntry {
	id: string;
	content: string;
	timestamp: number;
	source: "obsidian" | "system";
}

export type RibbonAction = "sidebar" | "fullView";

export interface ClipboardManagerSettings {
	historyLimit: number;
	pollingInterval: number;
	autoDeleteAfterPaste: boolean;
	ribbonAction: RibbonAction;
	trackSystemClipboard: boolean;
	pinSystemClipboard: boolean;

	allowDuplicates: boolean;
	ignoreWhitespaceOnly: boolean;
	minimumCharacterCount: number;
}

export const DEFAULT_SETTINGS: ClipboardManagerSettings = {
	historyLimit: 500,
	pollingInterval: 1000,
	autoDeleteAfterPaste: false,
	ribbonAction: "fullView",
	trackSystemClipboard: true,
	pinSystemClipboard: false,

	allowDuplicates: false,
	ignoreWhitespaceOnly: true,
	minimumCharacterCount: 5,
};
