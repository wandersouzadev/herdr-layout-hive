import { exec, window } from "herdr";
import { safeUrl } from "./urls.js";

export function openUrl(url) {
  const safe = safeUrl(url);
  if (!safe) return;
  const platform = window()?.platform;
  if (platform === "windows") exec("powershell.exe", ["-NoProfile", "-Command", "Start-Process", safe]).catch(() => {});
  else if (platform === "linux") exec("xdg-open", [safe]).catch(() => {});
  else exec("open", ["--", safe]).catch(() => {});
}
