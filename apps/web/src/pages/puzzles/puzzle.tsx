import { Button, IconButton, Spacer } from "@awlt/design";
import clsx from "clsx";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";

import usePuzzle from "@/hooks/usePuzzle";
import { PuzzleBoard } from "@/puzzle-board";
import type { Puzzle } from "@/types";
import { request } from "@/utils/http";

const Wrapper = () => {
  return <PuzzlePage />;
};

const PuzzlePage = () => {
  const { id, collectionId } = useParams();
  const ref = useRef<HTMLDivElement>(null);
  const boardRef = useRef<PuzzleBoard | null>(null);
  const [, forceUpdate] = useState(0);
  const [updatedSolveState, setUpdatedSolveState] = useState(false);
  const [currentPuzzle, setCurrentPuzzle] = useState<Puzzle | null>(null);
  const navigate = useNavigate();

  const query = usePuzzle(id, collectionId);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUpdatedSolveState(false);
  }, [id]);

  useEffect(() => {
    if (query.data) {
      setCurrentPuzzle(query.data);
    }
  }, [query.data]);

  useEffect(() => {
    if (!ref.current || !currentPuzzle) {
      return;
    }

    if (!boardRef.current) {
      const board = new PuzzleBoard(ref.current, currentPuzzle);
      board.onUpdate = () => forceUpdate((n) => n + 1);
      boardRef.current = board;
      forceUpdate((n) => n + 1);
    } else {
      boardRef.current.loadPuzzle(currentPuzzle);
    }
  }, [currentPuzzle]);

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

  const renderComment = (comment: string) => {
    return comment.split("\n").map((line, index) => {
      const parts = line.split(/(<b>.*?<\/b>)/g);
      return (
        <p key={index} className="mb-[2px] max-w-[750px] font-[Roboto]! font-light text-(--gray-11) select-auto!">
          {index > 1 && <span className="whitespace-pre">{"    "}</span>}
          {index === 1 && <br />}
          {parts.map((part, i) => {
            const match = part.match(/^<b>(.*?)<\/b>$/);
            return match ? (
              <strong key={i} className="font-semibold text-(--gray-12)">
                {match[1]}
              </strong>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            );
          })}
        </p>
      );
    });
  };

  if (!currentPuzzle && query.isLoading) {
    return null;
  }

  if (!currentPuzzle) {
    return <p>Failed to load puzzle :(</p>;
  }

  const puzzle = currentPuzzle;

  const board = boardRef.current;

  console.log({ puzzle });

  const solvedEntirePuzzle =
    board?.puzzleState === "solved" && (!board.isInVariation || board.isInWinningUserVariation);

  return (
    <div className="grid w-full" ref={containerRef}>
      <div className="flex w-full flex-col items-center" style={{ transform: "translateX(calc(var(--sidebar-width, 0px) / -2))" }}>
        {collectionId && (
          <>
            <Button color="gray" variant="soft" onClick={() => navigate(`/collections/${collectionId}`)}>
              Back to collection
            </Button>
          </>
        )}
        <Spacer size="12" />
        <div className="flex w-full max-w-[500px] items-center justify-between gap-4">
          <IconButton
            isDisabled={!puzzle.previousPuzzleId}
            color="gray"
            size="sm"
            variant="soft"
            onClick={() => navigate(`/collections/${collectionId}/puzzles/${puzzle.previousPuzzleId}`)}
          >
            <ChevronLeftIcon />
          </IconButton>
          <h1 className="max-w-[330px] text-center text-xl font-semibold tracking-wider text-(--gray-12)">
            {puzzle.name}
          </h1>
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
          {solvedEntirePuzzle && "You solved the puzzle!"}
          {board?.puzzleState === "solved" &&
            board.isInVariation &&
            !board.isInWinningUserVariation &&
            "Variation solved."}
          {board?.puzzleState === "badmove" && "Wrong move."}
          {board?.puzzleState === "goodmove" && "Possible move, but find something else!"}
        </p>
        {board?.isInVariation && !board.isInWinningUserVariation && (
          <>
            <Spacer size="2" />
            <p className="text-xl text-(--blue-11)">Variation</p>
          </>
        )}

        <Spacer size="4" />

        {solvedEntirePuzzle && puzzle.comments !== undefined && (
          <>
            <Spacer size="4" />
            {renderComment(puzzle.comments)}
          </>
        )}

        {board?.puzzleState === "solved" && board.isInVariation && !board.isInWinningUserVariation && (
          <Button onClick={() => board.returnFromVariation()} className="w-[250px]">
            Return from variation
          </Button>
        )}

        {(board?.puzzleState === "badmove" || board?.puzzleState === "goodmove") && (
          <Button onClick={() => board.returnFromGoodOrBadMove()} className="w-[150px]">
            Continue
          </Button>
        )}

        <Spacer size="8" />
      </div>
    </div>
  );
};

export default Wrapper;
