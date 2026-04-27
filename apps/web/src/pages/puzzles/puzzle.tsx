import { Button, IconButton, Spacer } from "@awlt/design";
import clsx from "clsx";
import { ChevronLeft, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import usePuzzle from "@/hooks/usePuzzle";
import { PuzzleBoard } from "@/puzzle-board";
import { request } from "@/utils/http";

const PuzzlePage = () => {
  const { id, collectionId } = useParams();
  const ref = useRef<HTMLDivElement>(null);
  const boardRef = useRef<PuzzleBoard | null>(null);
  const [, forceUpdate] = useState(0);
  const [updatedSolveState, setUpdatedSolveState] = useState(false);
  const navigate = useNavigate();

  const query = usePuzzle(id, collectionId);

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

  useEffect(() => {
    const state = boardRef.current?.puzzleState;

    if (!state || updatedSolveState) {
      return;
    }

    const updateSolveState = async () => {
      let status: string | null = null;

      if (state === "wrong" || state === "badmove") {
        status = "fail";
      } else if (state === "solved") {
        status = "success";
      } else {
        return;
      }

      const resp = await request(`/puzzles/${id}/updatestatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
        }),
      });

      if (resp.ok) {
        console.log("updated status to", status);
        setUpdatedSolveState(true);
        return;
      }

      console.error("failed to update status");

      const json = await resp.json();
      console.log({ json });
    };

    updateSolveState();
  }, [boardRef.current?.puzzleState, updatedSolveState, id]);

  if (query.isLoading) {
    return null;
  }

  const puzzle = query.data;

  if (!puzzle) {
    return <p>Failed to load puzzle :(</p>;
  }

  const board = boardRef.current;

  return (
    <div className="grid w-full">
      <div className="flex w-full flex-col items-center">
        <div className="flex w-full max-w-[500px] items-center justify-between">
          <IconButton
            isDisabled={!puzzle.previousPuzzleId}
            color="gray"
            size="sm"
            variant="soft"
            onClick={() => navigate(`/collections/${collectionId}/puzzles/${puzzle.previousPuzzleId}`)}
          >
            <ChevronLeftIcon />
          </IconButton>
          <h1 className="text-xl font-semibold tracking-wider text-(--gray-12)">{puzzle.name}</h1>
          <IconButton
            isDisabled={!puzzle.nextPuzzleId}
            color="gray"
            size="sm"
            variant="soft"
            onClick={() => navigate(`/collections/${collectionId}/puzzles/${puzzle.nextPuzzleId}`)}
          >
            <ChevronRightIcon />
          </IconButton>
        </div>
        <Spacer size="2" />
        <div ref={ref} className="blue merida" />
        <Spacer size="8" />
        <p
          className={clsx(
            "text-xl font-semibold",
            board?.puzzleState === "findmove" && "text-(--gray-12)",
            board?.puzzleState === "correct" && "text-(--green-11)",
            board?.puzzleState === "wrong" && "text-(--red-11)",
            board?.puzzleState === "solved" && "text-(--green-11)",
            board?.puzzleState === "badmove" && "text-(--red-11)",
            board?.puzzleState === "goodmove" && "text-(--orange-11)",
          )}
        >
          {board?.puzzleState === "findmove" && `Find the best move for ${board?.playerSide}`}
          {board?.puzzleState === "correct" && "Correct!"}
          {board?.puzzleState === "wrong" && "Wrong move."}
          {board?.puzzleState === "solved" && !board.isInVariation && "You solved the puzzle!"}
          {board?.puzzleState === "solved" && board.isInVariation && "Variation solved."}
          {board?.puzzleState === "badmove" && "Wrong move."}
          {board?.puzzleState === "goodmove" && "Possible move, but find something else!"}
        </p>
        {board?.isInVariation && (
          <>
            <Spacer size="2" />
            <p className="text-xl text-(--blue-11)">Variation</p>
          </>
        )}

        <Spacer size="4" />

        {board?.puzzleState === "solved" && board.isInVariation && (
          <Button onClick={() => board.returnFromVariation()} className="w-[250px]">
            Return from variation
          </Button>
        )}

        {(board?.puzzleState === "badmove" || board?.puzzleState === "goodmove") && (
          <Button onClick={() => board.returnFromGoodOrBadMove()} className="w-[150px]">
            Continue
          </Button>
        )}
      </div>
    </div>
  );
};

export default PuzzlePage;
