import { Spacer, Toast } from "@awlt/design";
import { useRef } from "react";
import { Outlet } from "react-router";

import Sidebar from "../components/sidebar";
import useScrollRestoration from "../hooks/useScrollRestoration";

const AppRoot = () => {
  const scrollRef = useRef<HTMLElement>(null);
  useScrollRestoration({
    scrollRef,
  });

  return (
    <>
      <div className="relative h-dvh bg-(--gray-1) text-(--gray-12)">
        <div className="flex h-full w-full">
          <Sidebar />

          <div className="relative flex h-full w-full min-w-0 justify-center">
            <div className="relative h-full w-full max-w-[1800px]">
              <main
                ref={scrollRef}
                className="grid h-full w-full grid-rows-[1fr_auto] content-start items-start overflow-y-auto *:col-[content]"
                style={{
                  gridTemplateColumns:
                    "[breakout-start] var(--content-side-padding) [content-start] 1fr [content-end] var(--content-side-padding) [breakout-end]",
                }}
              >
                <div className="col-[breakout]! grid grid-cols-subgrid *:col-[content]">
                  <Spacer size="4" />
                  <Outlet />
                </div>
              </main>
            </div>
          </div>
        </div>
        <Toast />
      </div>
    </>
  );
};

export default AppRoot;
