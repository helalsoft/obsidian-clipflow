import { Editor, MarkdownView, normalizePath, Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { ClipboardManagerSettingTab } from "./settings";
import { ClipboardQuickSwitcher } from "./quickSwitcher";
import { ClipboardSidebarView, SIDEBAR_VIEW_TYPE } from "./sidebarView";
import { ClipboardFullHistoryView, FULL_HISTORY_VIEW_TYPE } from "./fullHistoryView";
import { ClipboardEntry, ClipboardManagerSettings, DEFAULT_SETTINGS } from "./types";
import { ConfirmClearModal } from "./confirmModal";

interface ClipboardManagerData {
	settings: ClipboardManagerSettings;
	history: ClipboardEntry[];
	systemEntry: ClipboardEntry | null;
}

export default class ClipboardManagerPlugin extends Plugin {
	settings: ClipboardManagerSettings = DEFAULT_SETTINGS;
	clipboardHistory: ClipboardEntry[] = [];
	systemClipboardEntry: ClipboardEntry | null = null;
	private clipboardMonitorInterval: number | null = null;
	private lastClipboardContent: string = "";
	private lastActiveEditor: Editor | null = null;
	private lastActiveView: MarkdownView | null = null;
	private originalWriteText: ((text: string) => Promise<void>) | null = null;
	private bufferFile: TFile | null = null;
	private static readonly BUFFER_FILE_PATH = "clipflow-buffer.md";

	async onload(): Promise<void> {
		await this.loadSettings();

		// Register views
		this.registerView(SIDEBAR_VIEW_TYPE, (leaf) => new ClipboardSidebarView(leaf, this));
		this.registerView(FULL_HISTORY_VIEW_TYPE, (leaf) => new ClipboardFullHistoryView(leaf, this));

		// Add ribbon icon
		this.addRibbonIcon("clipboard-list", "Clipboard history", () => {
			if (this.settings.ribbonAction === "sidebar") {
				void this.activateSidebarView();
			} else {
				void this.openFullHistoryView();
			}
		});

		// Add commands
		this.addCommand({
			id: "quick-paste",
			name: "Quick paste from history",
			callback: () => {
				new ClipboardQuickSwitcher(this).open();
			},
		});

		this.addCommand({
			id: "toggle-sidebar",
			name: "Toggle sidebar history view",
			callback: () => {
				this.toggleSidebarView();
			},
		});

		this.addCommand({
			id: "open-full-history",
			name: "Open full history view",
			callback: () => {
				void this.openFullHistoryView();
			},
		});

		this.addCommand({
			id: "clear-history",
			name: "Clear clipboard history",
			callback: () => {
				this.clearHistory();
			},
		});

		this.addCommand({
			id: "edit-clipboard",
			name: "Edit clipboard",
			callback: () => {
				void this.openClipboardBuffer();
			},
		});

		// Add settings tab
		this.addSettingTab(new ClipboardManagerSettingTab(this.app, this));

		// Track last active editor for pasting from sidebar
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf) {
					const view = leaf.view;
					if (view instanceof MarkdownView) {
						this.lastActiveView = view;
						this.lastActiveEditor = view.editor;
					}
				}
			})
		);

		// Start clipboard monitoring
		this.startClipboardMonitor();

		// Handle instant copies within Obsidian
		this.registerDomEvent(document, "copy", () => {
			// Small delay to let the clipboard update
			setTimeout(() => void this.handleObsidianCopy(), 50);
		});

		// Monkey-patch navigator.clipboard.writeText for programmatic copies (Vim support)
		this.originalWriteText = navigator.clipboard.writeText.bind(navigator.clipboard);
		navigator.clipboard.writeText = async (text: string) => {
			if (this.originalWriteText) {
				await this.originalWriteText(text);
				void this.handleObsidianCopy(text);
			}
		};

		// Initialize last clipboard content
		try {
			this.lastClipboardContent = await navigator.clipboard.readText();
		} catch {
			this.lastClipboardContent = "";
		}
	}

	onunload(): void {
		this.stopClipboardMonitor();
		if (this.originalWriteText) {
			navigator.clipboard.writeText = this.originalWriteText;
		}
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as ClipboardManagerData;
		if (data) {
			this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
			this.clipboardHistory = data.history || [];
			this.systemClipboardEntry = data.systemEntry || null;
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			history: this.clipboardHistory,
			systemEntry: this.systemClipboardEntry,
		});
	}

	startClipboardMonitor(): void {
		this.clipboardMonitorInterval = window.setInterval(
			() => void this.checkClipboard(),
			this.settings.pollingInterval
		);
		this.registerInterval(this.clipboardMonitorInterval);
	}

	stopClipboardMonitor(): void {
		if (this.clipboardMonitorInterval !== null) {
			window.clearInterval(this.clipboardMonitorInterval);
			this.clipboardMonitorInterval = null;
		}
	}

	restartClipboardMonitor(): void {
		this.stopClipboardMonitor();
		this.startClipboardMonitor();
	}

	private async checkClipboard(): Promise<void> {
		if (!this.settings.trackSystemClipboard) return;

		try {
			const currentContent = await navigator.clipboard.readText();
			
			// Detect if system clipboard was cleared (became empty)
			if (!currentContent && this.lastClipboardContent) {
				// Remove matching entries from history for privacy
				this.clipboardHistory = this.clipboardHistory.filter(
					(e) => e.content !== this.lastClipboardContent
				);
				this.systemClipboardEntry = null;
				this.lastClipboardContent = "";
				
				await this.saveSettings();
				this.refreshViews();
				return;
			}

			// Skip if content has only whitespace and setting is enabled
			if (this.settings.ignoreWhitespaceOnly && !currentContent.trim()) {
				return;
			}

			// Skip if content is shorter than minimum length
			if (currentContent.length < this.settings.minimumCharacterCount) {
				return;
			}
			
			// Skip if content hasn't changed or is empty
			if (!currentContent || currentContent === this.lastClipboardContent) {
				return;
			}

			// If current system clipboard matches the latest Obsidian entry, 
			// it means it was an internal copy. We don't need a separate system entry.
			if (this.clipboardHistory.length > 0 && this.clipboardHistory[0]!.content === currentContent) {
				this.lastClipboardContent = currentContent;
				if (this.systemClipboardEntry) {
					this.systemClipboardEntry = null;
					this.refreshViews();
				}
				return;
			}

			this.lastClipboardContent = currentContent;

			// Update (replace) system slot
			this.systemClipboardEntry = {
				id: 'system-slot',
				content: currentContent,
				timestamp: Date.now(),
				source: 'system'
			};

			// Save and refresh
			await this.saveSettings();
			this.refreshViews();
		} catch {
			// Silent failure
		}
	}

	private async handleObsidianCopy(forcedText?: string): Promise<void> {
		try {
			const currentContent = forcedText || await navigator.clipboard.readText();
			
			if (!currentContent) return;

			// Skip if content has only whitespace and setting is enabled
			if (this.settings.ignoreWhitespaceOnly && !currentContent.trim()) {
				return;
			}

			// Skip if content is shorter than minimum length
			if (currentContent.length < this.settings.minimumCharacterCount) {
				return;
			}

			// If duplicates are not allowed, check if it already exists in history
			if (!this.settings.allowDuplicates) {
				const existingIndex = this.clipboardHistory.findIndex(e => e.content === currentContent);
				if (existingIndex !== -1) {
					// Remove the existing entry so it can be re-added at the top
					this.clipboardHistory.splice(existingIndex, 1);
				}
			} else {
				// If duplicates ARE allowed, still skip if it's already exactly at the top
				if (this.clipboardHistory.length > 0 && this.clipboardHistory[0]!.content === currentContent) {
					this.lastClipboardContent = currentContent;
					return;
				}
			}

			this.lastClipboardContent = currentContent;

			// Create new entry
			const entry: ClipboardEntry = {
				id: this.generateId(),
				content: currentContent,
				timestamp: Date.now(),
				source: 'obsidian'
			};

			this.clipboardHistory.unshift(entry);
			this.trimHistory();

			// If we were showing a system entry that now matches this, clear it
			if (this.systemClipboardEntry && this.systemClipboardEntry.content === currentContent) {
				this.systemClipboardEntry = null;
			}

			await this.saveSettings();
			this.refreshViews();
		} catch {
			// Silent failure
		}
	}

	getCombinedHistory(): ClipboardEntry[] {
		const history = [...this.clipboardHistory];
		if (this.systemClipboardEntry) {
			if (this.settings.pinSystemClipboard) {
				return [this.systemClipboardEntry, ...history];
			} else {
				history.push(this.systemClipboardEntry);
				return history.sort((a, b) => b.timestamp - a.timestamp);
			}
		}
		return history;
	}

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	}

	trimHistory(): void {
		if (this.clipboardHistory.length > this.settings.historyLimit) {
			this.clipboardHistory = this.clipboardHistory.slice(0, this.settings.historyLimit);
		}
	}

	deleteEntry(id: string): void {
		if (id === 'system-slot') {
			this.systemClipboardEntry = null;
		} else {
			this.clipboardHistory = this.clipboardHistory.filter((e) => e.id !== id);
		}
		void this.saveSettings();
		this.refreshViews();
	}

	clearHistory(): void {
		new ConfirmClearModal(this.app, () => {
			void (async () => {
				this.clipboardHistory = [];
				this.systemClipboardEntry = null;
				await this.saveSettings();
				this.refreshViews();
			})();
		}).open();
	}

	pasteEntry(entry: ClipboardEntry): void {
		// Try current active view first
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		let editor = view?.editor;

		// Fall back to last active editor if current view is not a MarkdownView
		if (!editor && this.lastActiveEditor && this.lastActiveView) {
			// Verify the view is still valid (not closed)
			const leaves = this.app.workspace.getLeavesOfType("markdown");
			const isStillOpen = leaves.some((leaf) => leaf.view === this.lastActiveView);
			if (isStillOpen) {
				editor = this.lastActiveEditor;
				view = this.lastActiveView;
			}
		}

		if (editor && view) {
			editor.replaceSelection(entry.content);

			// If it's a system entry, add it to the history
			if (entry.source === 'system') {
				void this.handleObsidianCopy(entry.content);
			}
			
			// Focus the view after pasting
			const leaf = this.app.workspace.getLeaf(false);
			if (leaf && leaf.view === view) {
				this.app.workspace.setActiveLeaf(leaf, { focus: true });
			}

			if (this.settings.autoDeleteAfterPaste && entry.source !== 'system') {
				this.deleteEntry(entry.id);
			}
		} else {
			new Notice("No active note to paste into");
		}
	}

	refreshViews(): void {
		// Refresh sidebar views
		try {
			this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE).forEach((leaf) => {
				const view = leaf.view as ClipboardSidebarView;
				if (view) view.renderView();
			});
		} catch (error) {
			console.error("ClipFlow: Error refreshing sidebar view", error);
		}

		// Refresh full history views
		try {
			this.app.workspace.getLeavesOfType(FULL_HISTORY_VIEW_TYPE).forEach((leaf) => {
				const view = leaf.view as ClipboardFullHistoryView;
				if (view) view.renderView();
			});
		} catch (error) {
			console.error("ClipFlow: Error refreshing full history view", error);
		}
	}

	async activateSidebarView(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0]!;
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: SIDEBAR_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	toggleSidebarView(): void {
		const leaves = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
		if (leaves.length > 0) {
			leaves[0]!.detach();
		} else {
			void this.activateSidebarView();
		}
	}

	async openFullHistoryView(): Promise<void> {
		const { workspace } = this.app;

		// Check if already open
		const existingLeaves = workspace.getLeavesOfType(FULL_HISTORY_VIEW_TYPE);
		if (existingLeaves.length > 0) {
			void workspace.revealLeaf(existingLeaves[0]!);
			return;
		}

		// Open in a new leaf
		const leaf = workspace.getLeaf("tab");
		if (leaf) {
			await leaf.setViewState({ type: FULL_HISTORY_VIEW_TYPE, active: true });
			void workspace.revealLeaf(leaf);
		}
	}

	/**
	 * Replace entire clipboard history with new entries.
	 */
	replaceHistory(entries: ClipboardEntry[]): void {
		this.clipboardHistory = entries;
		void this.saveSettings();
		this.refreshViews();
	}

	private static readonly ENTRY_SEPARATOR = "---";

	/**
	 * Convert clipboard history to text format for editing.
	 * Each entry is separated by a line containing only "---".
	 * Multiline entries are preserved as-is.
	 */
	private historyToText(): string {
		return this.clipboardHistory
			.map(entry => entry.content)
			.join(`\n${ClipboardManagerPlugin.ENTRY_SEPARATOR}\n`);
	}

	/**
	 * Parse text back into clipboard entries.
	 * Entries are separated by lines containing only "---".
	 */
	private textToHistory(text: string): ClipboardEntry[] {
		const separator = ClipboardManagerPlugin.ENTRY_SEPARATOR;
		const rawEntries = text.split(new RegExp(`^${separator}$`, "m"));
		const entries: ClipboardEntry[] = [];
		const now = Date.now();

		for (let i = 0; i < rawEntries.length; i++) {
			const content = rawEntries[i]?.trim();
			if (!content) continue;

			entries.push({
				id: `${now}-${i}-${Math.random().toString(36).substring(2, 9)}`,
				content,
				timestamp: now - i,
				source: "obsidian",
			});
		}
		return entries;
	}

	/**
	 * Open clipboard buffer as a native Obsidian markdown file.
	 * Closing the file syncs changes back to history.
	 */
	async openClipboardBuffer(): Promise<void> {
		const { vault, workspace } = this.app;

		// If the buffer file is already open, just reveal it
		if (this.bufferFile) {
			const existingLeaf = workspace.getLeavesOfType("markdown").find(leaf => {
				const view = leaf.view as MarkdownView;
				return view?.file?.path === this.bufferFile?.path;
			});
			if (existingLeaf) {
				workspace.setActiveLeaf(existingLeaf, { focus: true });
				return;
			}
		}

		// Create/update buffer file content
		const content = this.historyToText();
		const filePath = normalizePath(ClipboardManagerPlugin.BUFFER_FILE_PATH);

		// Get existing file if it exists
		let file = vault.getFileByPath(filePath);

		if (file) {
			// File exists - modify it
			await vault.modify(file, content);
			this.bufferFile = file;
		} else {
			// Clean up any orphan file on disk not in vault cache
			if (await vault.adapter.exists(filePath)) {
				await vault.adapter.remove(filePath);
			}
			// Create new file
			this.bufferFile = await vault.create(filePath, content);
		}

		// Open in a new tab
		const leaf = workspace.getLeaf("tab");
		await leaf.openFile(this.bufferFile);

		// Defer close handler to skip initial layout-change events
		setTimeout(() => {
			const closeHandler = this.app.workspace.on("layout-change", () => {
				if (!this.bufferFile) return;

				// Check if the buffer file is still open
				const stillOpen = workspace.getLeavesOfType("markdown").some(l => {
					const view = l.view as MarkdownView;
					return view?.file?.path === this.bufferFile?.path;
				});

				if (!stillOpen) {
					void this.syncAndCleanupBuffer();
					this.app.workspace.offref(closeHandler);
				}
			});

			this.registerEvent(closeHandler);
		}, 500);
	}

	/**
	 * Sync buffer file content back to history and delete the buffer file.
	 */
	private async syncAndCleanupBuffer(): Promise<void> {
		if (!this.bufferFile) return;

		try {
			const content = await this.app.vault.read(this.bufferFile);
			const entries = this.textToHistory(content);
			this.replaceHistory(entries);

			// Delete the buffer file
			await this.app.vault.delete(this.bufferFile);
			new Notice("Clipboard history updated");
		} catch (error) {
			console.error("ClipFlow: Failed to sync buffer file", error);
		} finally {
			this.bufferFile = null;
		}
	}
}
