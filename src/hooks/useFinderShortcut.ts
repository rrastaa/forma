
import { useEffect, useRef } from "react";
import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";

type ShowForma = () => Promise<void>;

// Serialize register/unregister operations
let shortcutQueue: Promise<void> = Promise.resolve();

function enqueueShortcutTask(task: () => Promise<void>) {
  shortcutQueue = shortcutQueue
    .then(task)
    .catch((error) => {
      console.error("[FORMA] Shortcut lifecycle failed:", error);
    });

  return shortcutQueue;
}

export function useFinderShortcut(showForma: ShowForma) {
  const showFormaRef = useRef(showForma);

  // Keep the latest callback without re-registering the shortcut
  useEffect(() => {
    showFormaRef.current = showForma;
  }, [showForma]);

  useEffect(() => {
    const shortcut = "Alt+Shift+Space";
    let active = true;

    void enqueueShortcutTask(async () => {
      if (!active) return;

      // Remove any stale registration before registering again
      if (await isRegistered(shortcut)) {
        await unregister(shortcut);
      }

      if (!active) return;

      console.log("[FORMA] Registering:", shortcut);

      await register(shortcut, async (event) => {
        if (event.state !== "Pressed") return;

        console.log("[FORMA] Shortcut detected!");

        try {
          await showFormaRef.current();
        } catch (error) {
          console.error("[FORMA] Failed to show Forma:", error);
        }
      });

      console.log("[FORMA] Shortcut registration completed!");
    });

    return () => {
      active = false;

      void enqueueShortcutTask(async () => {
        if (await isRegistered(shortcut)) {
          await unregister(shortcut);
          console.log("[FORMA] Shortcut unregistered");
        }
      });
    };
  }, []);
}
