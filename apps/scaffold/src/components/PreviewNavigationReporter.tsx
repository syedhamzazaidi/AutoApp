import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export const PREVIEW_NAV_MESSAGE = "endian:preview-navigation";

export function PreviewNavigationReporter() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (window.parent === window) return;

    window.parent.postMessage(
      {
        type: PREVIEW_NAV_MESSAGE,
        url: window.location.href,
        navigationType: navigationType.toLowerCase(),
      },
      "*",
    );
  }, [location, navigationType]);

  return null;
}
