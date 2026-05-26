import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const ROUTES: Record<string, string> = {
  p: "/phones",
  g: "/phone-grid",
  v: "/videos",
  a: "/analytics",
  q: "/queue",
  s: "/settings",
  c: "/clients",
  n: "/generate",
  h: "/",
};

/** g + <letter> → navigate. Skips when typing in input/textarea/contenteditable. */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let armed = false;
    let armTimer: ReturnType<typeof setTimeout> | null = null;

    function isTyping(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return target.isContentEditable;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      if (e.key === "g" && !armed) {
        armed = true;
        if (armTimer) clearTimeout(armTimer);
        armTimer = setTimeout(() => {
          armed = false;
        }, 1200);
        return;
      }
      if (armed) {
        const route = ROUTES[e.key.toLowerCase()];
        armed = false;
        if (armTimer) clearTimeout(armTimer);
        if (route) {
          e.preventDefault();
          navigate(route);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (armTimer) clearTimeout(armTimer);
    };
  }, [navigate]);
}
