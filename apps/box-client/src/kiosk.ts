// Kiosk-mode helpers — fullscreen + wake lock + scroll lock for the host tablet.
// Most browsers require a user gesture to enter fullscreen, so we attach to the
// first tap on the document.

let wakeLock: any = null;
let installed = false;

export function installKioskMode() {
  if (installed) return;
  installed = true;

  // Prevent scroll bouncing on the tablet
  document.body.style.overscrollBehavior = "none";

  const enter = async () => {
    // Fullscreen on first tap (host's first interaction)
    try {
      const el: any = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: "hide" });
      }
    } catch { /* permission denied or not supported */ }

    // Screen wake lock — prevents Android from dimming/sleeping
    try {
      if ("wakeLock" in navigator) {
        wakeLock = await (navigator as any).wakeLock.request("screen");
      }
    } catch { /* permission denied */ }

    // Re-acquire wake lock when tab returns to focus
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState === "visible" && !wakeLock) {
        try {
          if ("wakeLock" in navigator) wakeLock = await (navigator as any).wakeLock.request("screen");
        } catch {}
      }
    });
  };

  // Trigger on first user interaction
  const opts = { once: true } as AddEventListenerOptions;
  document.addEventListener("click", enter, opts);
  document.addEventListener("touchstart", enter, opts);
}
