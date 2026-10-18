import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";

/**
 * Render `ui` at "/" inside a memory router that also has /artist/$mbid, so
 * components using `Link` get a router context and navigation can be asserted.
 */
export async function renderWithRouter(ui: ReactElement) {
  const root = createRootRoute({ component: Outlet });
  const index = createRoute({ getParentRoute: () => root, path: "/", component: () => ui });
  const artist = createRoute({
    getParentRoute: () => root,
    path: "/artist/$mbid",
    component: () => <p>artist page</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, artist]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  // Resolve the initial match first so the first render already shows `ui`.
  await router.load();
  const result = render(<RouterProvider router={router} />);
  return { router, ...result };
}
