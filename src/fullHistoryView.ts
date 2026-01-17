import { ItemView, WorkspaceLeaf, setIcon, Notice } from "obsidian";
import type ClipboardManagerPlugin from "./main";

export const FULL_HISTORY_VIEW_TYPE = "clipboard-full-history";

export class ClipboardFullHistoryView extends ItemView {
	plugin: ClipboardManagerPlugin;
	private searchQuery: string = "";

	constructor(leaf: WorkspaceLeaf, plugin: ClipboardManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return FULL_HISTORY_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Full clipboard history";
	}

	getIcon(): string {
		return "clipboard-list";
	}

	async onOpen(): Promise<void> {
		this.renderView();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	renderView(): void {
		const container = this.contentEl;
		container.empty();
		container.addClass("clipboard-full-history");

		const innerContainer = container.createDiv({ cls: "clipboard-full-inner" });

		// Header
		const header = innerContainer.createDiv({ cls: "clipboard-full-header" });
		
		const titleSection = header.createDiv({ cls: "clipboard-full-title-section" });
		titleSection.createEl("h2", { text: "Clipboard history" });
		
		const history = this.plugin.getCombinedHistory();

		// Controls
		const controls = header.createDiv({ cls: "clipboard-full-controls" });
		
		if (history.length >= 3) {
			const searchInput = controls.createEl("input", {
				type: "text",
				placeholder: `Search in ${history.length} entries...`,
				cls: "clipboard-full-search",
				value: this.searchQuery,
			});
			searchInput.addEventListener("input", (e) => {
				this.searchQuery = (e.target as HTMLInputElement).value;
				this.renderEntries();
			});

			const clearBtn = controls.createEl("button", { 
				cls: "clipboard-clear-all-btn",
				text: "Clear history"
			});
			clearBtn.addEventListener("click", () => {
				this.plugin.clearHistory();
			});
		} else {
			this.searchQuery = "";
		}

		// Entries container
		innerContainer.createDiv({ cls: "clipboard-full-list" });
		this.renderEntries();
	}

	private renderEntries(): void {
		const listContainer = this.contentEl.querySelector(".clipboard-full-list");
		if (!listContainer) return;
		listContainer.empty();

		const history = this.plugin.getCombinedHistory();
		const query = this.searchQuery.toLowerCase();
		const filteredEntries = query
			? history.filter((e) => e.content.toLowerCase().includes(query))
			: history;

		if (filteredEntries.length === 0) {
			const emptyState = listContainer.createDiv({ cls: "clipboard-full-empty" });
			emptyState.setText(
				this.searchQuery
					? "No entries match your search."
					: "No clipboard entries yet. Copy something to get started!"
			);
			return;
		}

		filteredEntries.forEach((entry, index) => {
			const entryEl = listContainer.createDiv({ 
				cls: `clipboard-full-entry ${entry.source === 'system' ? 'clipboard-entry-system' : 'clipboard-entry-obsidian'}` 
			});

			// Entry number and timestamp
			const meta = entryEl.createDiv({ cls: "clipboard-full-entry-meta" });
			
			const sourceIcon = meta.createSpan({ cls: "clipboard-entry-source-badge" });
			setIcon(sourceIcon, entry.source === 'system' ? 'monitor' : 'edit-3');
			sourceIcon.setAttribute("title", entry.source === 'system' ? 'System Clipboard' : 'Obsidian Clipboard');

			meta.createSpan({ cls: "clipboard-entry-number", text: `#${index + 1}` });
			const date = new Date(entry.timestamp);
			meta.createSpan({ cls: "clipboard-entry-timestamp", text: date.toLocaleString() });

			// Actions (moved to meta)
			const actions = meta.createDiv({ cls: "clipboard-full-entry-actions" });

			const copyBtn = actions.createEl("button", { 
				cls: "clipboard-full-action-btn",
				attr: { "aria-label": "Copy" }
			});
			setIcon(copyBtn, "copy");
			copyBtn.addEventListener("click", () => {
				void (async () => {
					await navigator.clipboard.writeText(entry.content);
					new Notice("Copied from clipboard history");
				})();
			});

			const deleteBtn = actions.createEl("button", { 
				cls: "clipboard-full-action-btn clipboard-delete-btn",
				attr: { "aria-label": "Delete" }
			});
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", () => {
				this.plugin.deleteEntry(entry.id);
				new Notice("Deleted from clipboard history");
			});

			// Content
			const content = entryEl.createDiv({ cls: "clipboard-full-entry-content" });
			content.createEl("pre", { text: entry.content });

		});
	}
}
