import { ItemView, type WorkspaceLeaf, type Plugin } from "obsidian";
import { h, render } from "preact";
import { App } from "../ui/App";
import { TempoStore } from "../core/store";

export const TEMPO_VIEW_TYPE = "crisp-tempo-view";

export class TempoView extends ItemView {
  private plugin: Plugin;

  constructor(leaf: WorkspaceLeaf, plugin: Plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TEMPO_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Tempo";
  }

  getIcon(): string {
    return "crisp-tempo";
  }

  async onOpen(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("tempo-view-container");
    render(h(App, { plugin: this.plugin, leaf: this.leaf }), container);
  }

  async onClose(): Promise<void> {
    await TempoStore.get(this.plugin).flush();
    render(null, this.contentEl);
  }
}
