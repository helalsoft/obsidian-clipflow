import { ItemView, WorkspaceLeaf, setIcon, Notice } from "obsidian";
import type ClipboardManagerPlugin from "./main";
import { ClipboardEntry } from "./types";

export const SIDEBAR_VIEW_TYPE = "clipboard-history-sidebar";

export class ClipboardSidebarView extends ItemView {
	plugin: ClipboardManagerPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: ClipboardManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return SIDEBAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Clipboard history";
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
		container.addClass("clipboard-sidebar");

		// Header
		const header = container.createDiv({ cls: "clipboard-sidebar-header" });
		header.createEl("h4", { text: "Clipboard history" });
		
		const history = this.plugin.getCombinedHistory();
		
		if (history.length >= 3) {
			
			// Search container (with search input and clear button)
			const searchContainer = container.createDiv({ cls: "clipboard-search-container" });
			
			const searchInput = searchContainer.createEl("input", {
				type: "text",
				placeholder: `Search in ${history.length} entr${history.length === 1 ? 'y' : 'ies'}...`,
				cls: "clipboard-search-input",
			});
			searchInput.addEventListener("input", (e) => {
				const query = (e.target as HTMLInputElement).value.toLowerCase();
				this.filterEntries(query);
			});

			const clearBtn = searchContainer.createEl("button", { 
				cls: "clipboard-sidebar-clear-btn",
				attr: { "aria-label": "Clear history" }
			});
			setIcon(clearBtn, "trash-2");
			clearBtn.addEventListener("click", () => {
				this.plugin.clearHistory();
			});
		}

		// Entry list
		const listContainer = container.createDiv({ cls: "clipboard-list" });

		if (history.length === 0) {
			listContainer.createDiv({
				cls: "clipboard-empty-state",
				text: "No clipboard entries yet. Copy something to get started!",
			});
		} else {
			history.forEach((entry) => {
				this.createEntryElement(listContainer, entry);
			});
		}
	}

	private createEntryElement(container: HTMLElement, entry: ClipboardEntry): HTMLElement {
		const entryEl = container.createDiv({ 
			cls: `clipboard-entry ${entry.source === 'system' ? 'clipboard-entry-system' : 'clipboard-entry-obsidian'}`, 
			attr: { "data-id": entry.id } 
		});

		// Source Icon
		const iconEl = entryEl.createDiv({ cls: "clipboard-entry-source-icon" });
		setIcon(iconEl, entry.source === 'system' ? 'monitor' : 'edit-3');
		iconEl.setAttribute("aria-label", entry.source === 'system' ? 'System Clipboard' : 'Obsidian Clipboard');

		// Content preview
		const content = entryEl.createDiv({ cls: "clipboard-entry-content" });
		const displayText = entry.content.length > 80 
			? entry.content.substring(0, 80) + "..." 
			: entry.content;
		content.setText(displayText.replace(/\n/g, " ↵ "));

		// Actions
		const actions = entryEl.createDiv({ cls: "clipboard-entry-actions" });

		const copyBtn = actions.createEl("button", { cls: "clipboard-action-btn", attr: { "aria-label": "Copy" } });
		setIcon(copyBtn, "copy");
		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			void (async () => {
				await navigator.clipboard.writeText(entry.content);
				new Notice("Copied from clipboard history");
			})();
		});

		const deleteBtn = actions.createEl("button", { cls: "clipboard-action-btn clipboard-delete-btn", attr: { "aria-label": "Delete" } });
		setIcon(deleteBtn, "trash-2");
		deleteBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.plugin.deleteEntry(entry.id);
			new Notice("Deleted from clipboard history");
		});

		// Click to paste
		entryEl.addEventListener("click", () => {
			this.plugin.pasteEntry(entry);
		});

		// Timestamp tooltip
		const date = new Date(entry.timestamp);
		entryEl.setAttribute("title", date.toLocaleString());

		return entryEl;
	}

	private filterEntries(query: string): void {
		const entries = this.contentEl.querySelectorAll(".clipboard-entry");
		const history = this.plugin.getCombinedHistory();
		entries.forEach((el) => {
			const id = el.getAttribute("data-id");
			const entry = history.find((e) => e.id === id);
			if (entry) {
				const matches = entry.content.toLowerCase().includes(query);
				(el as HTMLElement).style.display = matches ? "" : "none";
			}
		});
	}
}
