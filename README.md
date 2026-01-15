# ClipFlow

ClipFlow is a powerful clipboard manager plugin for Obsidian. It seamlessly captures, searches, and quick-pastes from your clipboard history directly within your Obsidian workspace.

## Features

- **Clipboard History**: Automatically captures everything you copy, whether from inside Obsidian or your system clipboard.
- **Sidebar View**: dedicated sidebar view to browse your clipboard history.
- **Full History View**: specialized tab view for managing and searching extended history.
- **Quick Paste**: "Quick Switcher"-like interface to rapidly find and paste clips.
- **System Clipboard Integration**: Optionally tracks and pins the current system clipboard content.
- **Configurable**: control history limits, duplicate handling, and more.
- **Vim Support**: Works with Obsidian's Vim mode.

## Installation

### Manual Installation

1.  Download the `main.js`, `manifest.json`, and `styles.css` files from the latest release.
2.  Create a folder named `obsidian-clipflow` in your vault's `.obsidian/plugins/` directory.
3.  Move the downloaded files into that folder.
4.  Reload Obsidian and enable "ClipFlow" in the Community Plugins settings.

### Development

If you want to build the plugin yourself:

1.  Clone this repository.
2.  Run `npm install` or `pnpm install` to install dependencies.
3.  Run `npm run build` to build the plugin.

## Usage

### Commands

- **Quick paste from history**: Opens a modal to search and paste from your history.
- **Toggle sidebar history view**: Opens or closes the clipboard history sidebar.
- **Open full history view**: Opens the detailed history management tab.
- **Clear clipboard history**: Removes all regular history entries.

### Views

- **Sidebar**: Shows recent clips. Click a clip to paste it into your active note.
- **Full History**: Provides a search bar and list of all clips. Allows deleting individual entries.

## Settings

- **Clipboard Polling Interval**: How often to check for system clipboard changes (default: 1000ms).
- **History Limit**: Maximum number of items to keep.
- **Allow Duplicates**: Whether to store duplicate copies as new entries.
- **Track System Clipboard**: Enable/disable monitoring of external copies.
- **Pin System Clipboard**: Keep the current system clipboard content at the top of the list.
- **Auto-delete after paste**: Remove an entry from history after you paste it.
- **Ribbon Button Action**: Choose whether the ribbon icon opens the sidebar or the full view.

## License

MIT
