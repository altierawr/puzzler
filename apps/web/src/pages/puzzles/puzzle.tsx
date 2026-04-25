import { Chessground } from "@lichess-org/chessground";
import { useEffect, useRef } from "react";
import { useParams } from "react-router";

import usePuzzle from "@/hooks/usePuzzle";

const PuzzlePage = () => {
  const { id } = useParams();
  const ref = useRef<HTMLDivElement>(null);

  const query = usePuzzle(id);

  useEffect(() => {
    console.log(ref.current);
    if (!ref.current) {
      return;
    }

    console.log("creating thing");

    const ground = Chessground(ref.current, {});
    console.log({ ground });

    return () => {
      ground.destroy();
    };
  }, [ref, query.data]);

  if (query.isLoading) {
    return <p>Loading...</p>;
  }

  console.log(query.data);

  return (
    <div ref={ref} className="blue merida grid">
      <div>
        <p>Hello</p>
      </div>
    </div>
  );
};

export default PuzzlePage;
