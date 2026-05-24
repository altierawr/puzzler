import { Button, Spacer, toastManager } from "@awlt/design";
import { parse } from "@mliebelt/pgn-parser";
import { useRef, useState } from "react";

import { request } from "@/utils/http";
import useCollections from "@/hooks/useCollections";

const CreatePage = () => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [importType, setImportType] = useState<"pgn" | "tablebase">("pgn");
  const [collectionName, setCollectionName] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const { data: collections } = useCollections();

  const handleImportClick = async () => {
    const str = textAreaRef.current?.value;
    if (!str) {
      return;
    }

    let parsedData: string[] = [];

    if (importType === "tablebase") {
      parsedData = str
        .split(/\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    } else {
      const moveLineRegex = /(^|\s)\d+\.(\s|$)/; // finds "1.", "23.", etc.
      const sanMoveRegex = /[KQRNB]?[a-h]?[1-8]?x?[a-h][1-8](=[QRNB])?[+#]?/; // matches SAN moves like Nf3, exd5, Qxd1+

      let currentPgnText = "";
      let wasLastLineMoves = false;
      let wasLastLineEmpty = false;
      const lines = str.split(/\n/);
      for (const l of lines) {
        const line = l.trim();

        if (!line) {
          wasLastLineMoves = false;
          wasLastLineEmpty = true;

          if (currentPgnText !== "") {
            currentPgnText += "\n";
          }
        } else if (line.startsWith("[")) {
          if (wasLastLineEmpty) {
            parsedData.push(currentPgnText);
            currentPgnText = "";
          }

          currentPgnText += line + "\n";
          wasLastLineMoves = false;
        } else if ((line && wasLastLineMoves) || moveLineRegex.test(line) || sanMoveRegex.test(line)) {
          wasLastLineMoves = true;
          currentPgnText += line + "\n";
        } else if (line) {
          currentPgnText += line + "\n";
        }

        if (line) {
          wasLastLineEmpty = false;
        }
      }

      if (currentPgnText !== "") {
        parsedData.push(currentPgnText);
      }

      let last = 0;
      let foundError = false;
      let currentPgn = 1;
      for (const pgn of parsedData) {
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
    }

    const resp = await request("/puzzles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: importType, data: parsedData, collectionName, collectionId }),
    });

    console.log(resp.status);
    const data = await resp.json();

    console.log({ data });
    
    if (resp.ok) {
        toastManager.add({
            title: `Successfully imported ${importType === 'pgn' ? 'PGNs' : 'Tablebase positions'}`,
            type: "success",
        });
        if (textAreaRef.current) {
            textAreaRef.current.value = '';
        }
        setCollectionName('');
    }
  };

  return (
    <div className="grid">
      <h1 className="text-2xl font-semibold">Create puzzles</h1>
      <Spacer size="8" />
      <div className="flex items-center gap-4 mb-2">
        <h2 className="text-lg font-medium">Import</h2>
        <select
          value={importType}
          onChange={(e) => setImportType(e.target.value as "pgn" | "tablebase")}
          className="rounded border border-(--gray-6) bg-transparent px-2 py-1 outline-none focus:border-(--blue-9)"
        >
          <option value="pgn">PGNs</option>
          <option value="tablebase">Tablebase (FENs)</option>
        </select>
      </div>
      <p className="text-(--red-11)">Note: this is only available to site admins for now!</p>
      <Spacer size="4" />
      <div className="flex flex-col gap-2 mb-4">
        <label className="text-sm font-medium">
          Collection for imported puzzles (optional)
        </label>
        <select
          value={collectionId}
          onChange={(e) => {
            setCollectionId(e.target.value);
            if (e.target.value) setCollectionName("");
          }}
          className="rounded border border-(--gray-6) bg-transparent p-2 outline-none focus:border-(--blue-9)"
        >
          <option value="">-- Create a new collection --</option>
          {collections?.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {!collectionId && (
          <input
            id="collectionName"
            type="text"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="New collection name (e.g. My Endgame Practice)"
            className="rounded border border-(--gray-6) bg-transparent p-2 outline-none focus:border-(--blue-9)"
          />
        )}
      </div>
      <textarea
        ref={textAreaRef}
        placeholder={importType === "pgn" ? "Paste PGNs here..." : "Paste FENs here, one per line..."}
        className="h-[400px] resize-none border border-(--gray-6) p-2"
      ></textarea>
      <Spacer size="2" />
      <Button className="w-[130px]" onClick={handleImportClick}>
        Import
      </Button>
    </div>
  );
};

export default CreatePage;
