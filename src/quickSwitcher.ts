import { FuzzySuggestModal, MarkdownView } from "obsidian";
import type ClipboardManagerPlugin from "./main";
import type { ClipboardEntry } from "./types";

export class ClipboardQuickSwitcher extends FuzzySuggestModal<ClipboardEntry> {
	plugin: ClipboardManagerPlugin;

	constructor(plugin: ClipboardManagerPlugin) {
		super(plugin.app);
		this.plugin = plugin;
		this.setPlaceholder("Search clipboard history...");
		this.setInstructions([
			{ command: "↑↓", purpose: "to navigate" },
			{ command: "↵", purpose: "to paste" },
			{ command: "esc", purpose: "to dismiss" },
		]);
	}

	getItems(): ClipboardEntry[] {
		return this.plugin.getCombinedHistory();
	}

	getItemText(item: ClipboardEntry): string {
		return item.content;
	}

	renderSuggestion(item: { item: ClipboardEntry; match: { score: number; matches: [number, number][] } }, el: HTMLElement): void {
		const entry = item.item;
		const container = el.createDiv({ cls: "clipboard-suggestion" });
		
		// Preview text (truncated)
		const preview = container.createDiv({ cls: "clipboard-suggestion-content" });
		const displayText = entry.content.length > 100 
			? entry.content.substring(0, 100) + "..." 
			: entry.content;
		preview.setText(displayText.replace(/\n/g, " ↵ "));

		// Timestamp and Source
		const meta = container.createDiv({ cls: "clipboard-suggestion-meta" });
		
		const source = meta.createSpan({ cls: "clipboard-suggestion-source" });
		source.setText(entry.source === 'system' ? 'System' : 'Obsidian');
		
		const timestamp = meta.createSpan({ cls: "clipboard-suggestion-timestamp" });
		const date = new Date(entry.timestamp);
		timestamp.setText(this.formatRelativeTime(date));
	}

	private formatRelativeTime(date: Date): string {
		const now = Date.now();
		const diff = now - date.getTime();
		const seconds = Math.floor(diff / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (seconds < 60) return "just now";
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return date.toLocaleDateString();
	}

	onChooseItem(item: ClipboardEntry): void {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view) {
			const editor = view.editor;
			editor.replaceSelection(item.content);

			if (this.plugin.settings.autoDeleteAfterPaste) {
				this.plugin.deleteEntry(item.id);
			}
		}
	}
}
