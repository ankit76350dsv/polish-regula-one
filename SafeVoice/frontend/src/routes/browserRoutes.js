import { useCallback, useEffect, useState } from "react";

export const PUBLIC_ROUTES = [
  "/report",
  "/track",
  "/report/success",
  "/access-denied",
];

export const STAFF_HOME_ROUTE = "/dashboard";

export const PAGE_TITLE_KEYS = {
  "/report": "nav.submitReport",
  "/report/success": "nav.submitReport",
  "/track": "nav.trackReport",
  "/access-denied": "accessDenied.title",
  "/dashboard": "nav.caseOperations",
  "/cases": "nav.caseRegister",
  "/cases/:id": "nav.caseRegister",
  "/messages": "nav.secureInbox",
  "/audits": "nav.auditTrail",
  "/users": "nav.accessControls",
  "/settings": "nav.complianceSettings",
};

const normalizePath = (path) => {
  const pathname = path.split("?")[0].split("#")[0].replace(/\/+$/, "");
  return pathname || "/report";
};

const routeFromBrowser = () => normalizePath(window.location.pathname);

const parseRoute = (path) => {
  const normalizedPath = normalizePath(path);

  if (normalizedPath.startsWith("/cases/")) {
    return {
      currentPath: "/cases/:id",
      selectedCaseId: decodeURIComponent(
        normalizedPath.replace("/cases/", ""),
      ),
    };
  }

  return {
    currentPath: normalizedPath,
    selectedCaseId: null,
  };
};

export function useBrowserRoute() {
  const [route, setRoute] = useState(() => parseRoute(routeFromBrowser()));

  const syncRoute = useCallback(() => {
    setRoute(parseRoute(routeFromBrowser()));
  }, []);

  useEffect(() => {
    if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/report");
    }

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, [syncRoute]);

  const navigateTo = useCallback((path, options = {}) => {
    const nextPath = normalizePath(path);
    const currentPath = routeFromBrowser();
    const method = options.replace ? "replaceState" : "pushState";

    if (currentPath !== nextPath) {
      window.history[method]({}, "", nextPath);
    }

    setRoute(parseRoute(nextPath));
  }, []);

  return {
    ...route,
    navigateTo,
  };
}
