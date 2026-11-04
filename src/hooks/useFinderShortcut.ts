
import { useEffect } from "react";
import { register, unregister } from "@tauri-apps/plugin-global-shortcut";

export function useFinderShortcut(showForma: () => Promise<void>) {
  useEffect(() => {
    const shortcut = "Alt+Shift+Space";
    let cancelled = false;

    const setup = async () => {
      try {
        console.log("[FORMA] Registering:", shortcut);

        await register(shortcut, async (event) => {
          console.log("[FORMA] Shortcut event:", event.state);

          if (event.state !== "Pressed") return;

          console.log("[FORMA] Shortcut detected!");

          try {
            await showForma();
          } catch (error) {
            console.error("[FORMA] Failed to show Forma:", error);
          }
        });

        if (cancelled) {
          await unregister(shortcut);
          return;
        }

        console.log("[FORMA] Shortcut registration completed!");
      } catch (error) {
        console.error("[FORMA] Shortcut registration failed:", error);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      void unregister(shortcut).catch(console.error);
    };
  }, [showForma]);
}
