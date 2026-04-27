import { createBrowserRouter } from "react-router";

import AccountPage from "./pages/account";
import AppRoot from "./pages/app-root";
import CollectionsPage from "./pages/collections";
import CollectionPage from "./pages/collections/collection";
import CreatePage from "./pages/create";
import HomePage from "./pages/home";
import LoginRegisterPage from "./pages/login-register";
import PuzzlePage from "./pages/puzzles/puzzle";
import Root from "./pages/root";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        children: [
          {
            path: "register",
            element: <LoginRegisterPage />,
          },
          {
            path: "login",
            element: <LoginRegisterPage />,
          },
          {
            path: "account",
            element: <AccountPage />,
          },
        ],
      },
      {
        element: <AppRoot />,
        path: "/",
        children: [
          {
            path: "/",
            element: <HomePage />,
          },
          {
            path: "/collections",
            element: <CollectionsPage />,
          },
          {
            path: "/collections/:id",
            element: <CollectionPage />,
          },
          {
            path: "/collections/:collectionId/puzzles/:id",
            element: <PuzzlePage />,
          },
          {
            path: "/create",
            element: <CreatePage />,
          },
          {
            path: "/puzzles/:id",
            element: <PuzzlePage />,
          },
        ],
      },
    ],
  },
]);

export default router;
