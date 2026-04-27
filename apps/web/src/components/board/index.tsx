import { Chessground } from "@lichess-org/chessground";
import { parseFen } from "chessops/fen";
import { useEffect, useRef } from "react";

type TProps = {
  fen: string;
};

const Board = ({ fen }: TProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const setup = parseFen(fen).unwrap();

    const ground = Chessground(ref.current, {
      fen: fen,
      orientation: setup.turn,
      viewOnly: true,
    });
  }, [fen, ref]);

  return (
    <>
      <div ref={ref} className="blue merida pointer-events-none" />
    </>
  );
};

export default Board;
