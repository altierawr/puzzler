import { Button, Spacer } from "@awlt/design";
import { toastManager } from "@awlt/design";
import { parse } from "@mliebelt/pgn-parser";
import { useRef } from "react";

import { request } from "@/utils/http";

const CreatePage = () => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleImportClick = async () => {
    const str = textAreaRef.current?.value;
    if (!str) {
      return;
    }

    const pgns: string[] = [];

    const moveLineRegex = /(^|\s)\d+\.(\s|$)/; // finds "1.", "23.", etc.
    const sanMoveRegex = /[KQRNB]?[a-h]?[1-8]?x?[a-h][1-8](=[QRNB])?[+#]?/; // matches SAN moves like Nf3, exd5, Qxd1+

    let currentPgnText = "";
    let wasLastLineMoves = false;
    const lines = str.split(/\n/);
    for (const l of lines) {
      const line = l.trim();

      if (!line && wasLastLineMoves) {
        pgns.push(currentPgnText);
        currentPgnText = "";
        wasLastLineMoves = false;
      } else if (!line) {
        continue;
      } else if (line.startsWith("[")) {
        currentPgnText += line + "\n";
        wasLastLineMoves = false;
      } else if (line === "*") {
        if (wasLastLineMoves) {
          currentPgnText += "\n" + line;
          wasLastLineMoves = false;
          pgns.push(currentPgnText);
          currentPgnText = "";
        } else {
          currentPgnText = "";
          wasLastLineMoves = false;
        }
      } else if ((line && wasLastLineMoves) || moveLineRegex.test(line) || sanMoveRegex.test(line)) {
        wasLastLineMoves = true;
        currentPgnText += "\n" + line;
      } else if (line) {
        console.log(line);
      }
    }

    let last = 0;
    let foundError = false;
    let currentPgn = 1;
    for (const pgn of pgns) {
      break;
      const n = pgn.split("Puzzle")[1].slice(0, 10);
      const y = parseInt(n.slice(0, n.indexOf('"')));
      if (y !== last + 1) {
        console.log("missing puzzle", y - 1);
      }

      last = y;

      try {
        parse(pgn, {
          startRule: "game",
        });
      } catch (e) {
        console.error("error with pgn", e);
        console.log(pgn);
        foundError = true;
        break;
      }

      currentPgn++;
    }

    if (foundError) {
      toastManager.add({
        title: "Failed to import PGN's",
        description: `There was an issue with the number ${currentPgn} pgn; it could not be loaded. Please check that all PGN's are properly formatted and try again`,
        type: "error",
      });
      return;
    }

    const resp = await request("/puzzles/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pgns: pgns.join("\n") }),
    });

    console.log(resp.status);
    const data = await resp.json();

    console.log({ data });
  };

  return (
    <div className="grid">
      <h1 className="text-2xl font-semibold">Create puzzles</h1>
      <Spacer size="8" />
      <h2 className="mb-2 text-lg font-medium">Import PGNs</h2>
      <p className="text-(--red-11)">Note: this is only available to site admins for now!</p>
      <textarea ref={textAreaRef} className="h-[400px] resize-none border border-(--gray-6)"></textarea>
      <Spacer size="2" />
      <Button className="w-[130px]" onClick={handleImportClick}>
        Import
      </Button>
    </div>
  );
};

export default CreatePage;
