import { App, Modal } from "obsidian";

export class ConfirmClearModal extends Modal {
	private onConfirm: () => void;

	constructor(app: App, onConfirm: () => void) {
		super(app);
		this.onConfirm = onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("clipboard-confirm-modal");

		contentEl.createEl("h3", { text: "Clear clipboard history" });
		contentEl.createEl("p", { 
			text: "Are you sure you want to clear all clipboard history? This action cannot be undone." 
		});

		const buttonContainer = contentEl.createDiv({ cls: "clipboard-confirm-buttons" });

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => {
			this.close();
		});

		const confirmBtn = buttonContainer.createEl("button", { 
			text: "Clear history",
			cls: "mod-warning"
		});
		confirmBtn.addEventListener("click", () => {
			this.close();
			this.onConfirm();
		});

		// Focus the cancel button by default (safer default)
		cancelBtn.focus();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
