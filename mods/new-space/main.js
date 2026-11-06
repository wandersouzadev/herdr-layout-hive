// New space: pick the machine (this computer or a remote one) and the folder
// the first terminal starts in, then create the space. Opened as a dialog
// from the sidebar's + button.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { machines, theme, props, run, closeOverlay, pickFolder, home } from "herdr";

const I = (name) => `mods/workspace-chrome/${name}.svg`;

export default class SpaceNew extends View {
  init(_props, cx) {
    this.selected = props()?.machine ?? "";
    this.path = "";
    this.browsing = false;
    this.input = InputState.new({ placeholder: "~/project or leave empty for home" });
    this.input.on("change", (_e, cx) => {
      this.path = this.input.value();
      cx.notify();
    });
    this.input.on("submit", (_e, cx) => this.create(cx));
    this.handle = cx.focus_handle();
    this.handle.focus();
    this.input.focus();
    cx.timer.after(100, () => this.input.focus());
  }

  key(e, cx) {
    if (e.key === "escape") closeOverlay(props().overlay);
    else if (e.key === "enter") this.create(cx);
    else return;
    cx.stop_propagation();
  }

  // Picks the environment row by machine name; "" is this computer.
  select(machine, cx) {
    this.selected = machine;
    this.input.set_value(this.path);
    cx.notify();
  }

  async browse(cx) {
    if (this.browsing) return;
    this.browsing = true;
    cx.notify();
    const picked = await pickFolder({ prompt: "Choose folder" }).catch(() => null);
    this.browsing = false;
    if (picked) {
      this.path = picked;
      this.input.set_value(picked);
    }
    cx.notify();
  }

  // The machine can create a space now: this computer always, remotes once ready.
  ready() {
    if (this.selected === "") return true;
    return machines().find((m) => m.name === this.selected)?.layout === "ready";
  }

  create(cx) {
    if (!this.ready()) return;
    let folder = (this.path ?? "").trim();
    if (!this.selected && folder) {
      if (folder === "~") folder = home();
      else if (folder.startsWith("~/") || folder.startsWith("~\\")) folder = home() + folder.slice(1);
    }
    const overlay = props()?.overlay;
    if (overlay) closeOverlay(overlay);
    run("space.new", { machine: this.selected, folder: folder || undefined });
    cx.notify();
  }

  machineRow(t, machine, label, sub, state) {
    const selected = this.selected === machine;
    const unavailable = state === "unavailable";
    const loading = state === "loading";
    return h_flex()
      .id(`new-space-machine-${machine || "local"}`)
      .h(42)
      .px(10)
      .gap(10)
      .items_center()
      .rounded(8)
      .border_1()
      .border_color(selected ? t.accent : t.popover)
      .bg(selected ? t.selected : t.popover)
      .when(!unavailable, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click((_e, cx) => this.select(machine, cx)))
      .when(unavailable, (el) => el.opacity(0.55))
      .child(svg(I(machine ? "server" : "monitor")).size(16).flex_none().text_color(selected ? t.accent : t.muted))
      .child(v_flex().flex_1().min_w(0).child(div().truncate().text_size(13).font_medium().text_color(t.foreground).child(label))
        .when(Boolean(sub), (el) => el.child(div().truncate().text_size(11.5).text_color(t.dim).child(sub))))
      .when(loading, (el) => el.child(svg(I("spinner")).size(13).flex_none().text_color(t.working).spin(900)))
      .when(unavailable, (el) => el.child(div().flex_none().text_size(11.5).text_color(t.dim).child("unavailable")))
      .when(selected && !loading && !unavailable, (el) => el.child(svg(I("check")).size(14).flex_none().text_color(t.accent)));
  }

  render(cx) {
    const t = theme();
    const remote = machines().filter((m) => m.name).slice().sort((a, b) => a.name.localeCompare(b.name));
    const selectedRemote = this.selected ? remote.find((m) => m.name === this.selected) : null;
    const selectedUnavailable = selectedRemote && selectedRemote.layout !== "ready";
    const isLocal = !this.selected;
    return v_flex()
      .id("new-space")
      .track_focus(this.handle)
      .on_key_down((e, cx) => this.key(e, cx))
      .w_full()
      .min_h(0)
      .p(18)
      .gap(14)
      .bg(t.popover)
      .text_color(t.foreground)
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().child("New space")).child(div().text_size(11).text_color(t.dim).child("Esc")))
      .child(div().text_size(12.5).line_height("18px").text_color(t.muted).child("Choose where the first terminal starts. Leave the path empty to open the machine's home folder."))
      .child(v_flex().gap(6)
        .child(div().text_size(11.5).font_medium().text_color(t.dim).child("Environment"))
        .child(v_flex().id("new-space-machines").gap(2)
          .child(this.machineRow(t, "", "This computer", "local shell", "ready"))
          .children(remote.map((m) => this.machineRow(t, m.name, m.name, m.layout === "ready" ? "remote" : m.layout === "loading" ? "checking connection…" : "offline or unavailable", m.layout)))))
      .child(v_flex().gap(6)
        .child(h_flex().items_center().child(div().flex_1().text_size(11.5).font_medium().text_color(t.dim).child("Path"))
          .when(isLocal, (el) => el.child(div().id("new-space-browse").h(24).px(10).flex().items_center().gap(5).rounded(6).text_size(11.5).text_color(t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground)).cursor_pointer().on_click((_e, cx) => this.browse(cx)).child(svg(I("folder")).size(12)).child(this.browsing ? "Opening…" : "Browse…"))))
        .child(Input.new(this.input)
          .id("new-space-path")
          .h(34)
          .px(10)
          .rounded(8)
          .border_1()
          .border_color(t.input)
          .bg(t.background)
          .text_size(13)
          .text_color(t.foreground))
        .child(div().text_size(11.5).text_color(t.dim).child(isLocal ? "Absolute path, or ~ for your home." : "Path on the remote machine, e.g. /home/you/project.")))
      .when(Boolean(selectedUnavailable), (el) => el.child(div().text_size(12).text_color(t.blocked).child("This machine is not ready, so the space can't be created there yet.")))
      .child(h_flex().justify_end().gap(8).text_size(12.5)
        .child(div().id("new-space-cancel").h(32).px(14).flex().items_center().rounded(8).border_1().border_color(t.input).bg(t.raised).text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => closeOverlay(props().overlay)).child("Cancel"))
        .child(div().id("new-space-create").h(32).px(16).flex().items_center().rounded(8).bg(t.solid).text_color(t.solid_foreground).font_medium().cursor_pointer().hover((s) => s.opacity(0.88)).when(!this.ready(), (el) => el.opacity(0.4)).on_click((_e, cx) => this.create(cx)).child("Create space")));
  }
}
