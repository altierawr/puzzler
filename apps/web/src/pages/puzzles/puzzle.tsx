import { Button, Spacer } from "@awlt/design";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

import usePuzzle from "@/hooks/usePuzzle";
import { PuzzleBoard } from "@/puzzle-board";

const PuzzlePage = () => {
  const { id } = useParams();
  const ref = useRef<HTMLDivElement>(null);
  const boardRef = useRef<PuzzleBoard | null>(null);
  const [, forceUpdate] = useState(0);

  const query = usePuzzle(id);

  useEffect(() => {
    if (!ref.current || !query.data) {
      return;
    }

    const board = new PuzzleBoard(ref.current, query.data);
    board.onUpdate = () => forceUpdate((n) => n + 1);
    boardRef.current = board;
    forceUpdate((n) => n + 1);

    return () => {
      boardRef.current = null;
    };
  }, [ref, query.data]);

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  const board = boardRef.current;

  return (
    <div className="grid">
      <div ref={ref} className="blue merida" />
      <Spacer size="4" />
      <p
        className={clsx(
          "text-xl font-semibold",
          board?.puzzleState === "findmove" && "text-(--gray-12)",
          board?.puzzleState === "correct" && "text-(--green-11)",
          board?.puzzleState === "wrong" && "text-(--red-11)",
          board?.puzzleState === "solved" && "text-(--blue-11)",
          board?.puzzleState === "badmove" && "text-(--red-11)",
          board?.puzzleState === "goodmove" && "text-(--blue-11)",
        )}
      >
        {board?.puzzleState === "findmove" && "Find the best move"}
        {board?.puzzleState === "correct" && "Correct!"}
        {board?.puzzleState === "wrong" && "Wrong move."}
        {board?.puzzleState === "solved" && !board.isInVariation && "You solved the puzzle!"}
        {board?.puzzleState === "solved" && board.isInVariation && "Variation solved."}
        {board?.puzzleState === "badmove" && "Wrong move."}
        {board?.puzzleState === "goodmove" && "Possible move, but find something else!"}
      </p>

      {board?.puzzleState === "solved" && board.isInVariation && (
        <Button onClick={() => board.returnFromVariation()} className="w-[250px]">
          Return from variation
        </Button>
      )}

      {(board?.puzzleState === "badmove" || board?.puzzleState === "goodmove") && (
        <Button onClick={() => board.returnFromGoodOrBadMove()} className="w-[250px]">
          Continue
        </Button>
      )}

      {board?.isInVariation && <p className="text-xl text-(--blue-11)">Variation</p>}
    </div>
  );
};

export default PuzzlePage;
