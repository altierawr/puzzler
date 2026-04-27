package database

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/altierawr/puzzler/internal/data"
	"github.com/altierawr/puzzler/utils"
	"github.com/gofrs/uuid"
	"github.com/jmoiron/sqlx"
)

func (db *DB) InsertPuzzles(puzzles []data.Puzzle) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	tx, err := db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	baseTime := time.Now()

	for i, puzzle := range puzzles {
		puzzle.CreatedAt = baseTime.Add(time.Duration(i) * time.Microsecond)
		err := db.InsertPuzzle(&puzzle, tx)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (db *DB) SetPuzzleSolveStatus(id string, userId uuid.UUID, status string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `
			INSERT INTO puzzle_solves (puzzles_id, users_id, status)
			VALUES ($1, $2, $3::solve_status)
			ON CONFLICT (puzzles_id, users_id)
			DO UPDATE SET status = EXCLUDED.status
		`

	_, err := db.ExecContext(ctx, query, id, userId, status)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return ErrRecordNotFound
		default:
			return err
		}
	}

	return err
}

func (db *DB) InsertPuzzle(puzzle *data.Puzzle, tx *sqlx.Tx) error {
	if puzzle == nil {
		return errors.New("puzzle is nil")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `
		INSERT INTO puzzles (id, name, fen, moves, created_by, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		`

	id, err := utils.GenerateAlphabeticId(8)
	if err != nil {
		return err
	}

	args := []any{id, puzzle.Name, puzzle.Fen, puzzle.Moves, puzzle.CreatedById, puzzle.CreatedAt}

	if tx != nil {
		_, err = tx.ExecContext(ctx, query, args...)
	} else {
		_, err = db.ExecContext(ctx, query, args...)
	}

	return err
}

func (db *DB) GetCollectionPuzzle(collectionId string, id string) (*data.Puzzle, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `
		WITH ordered AS (
			SELECT
				p.id,
				p.name,
				p.fen,
				p.moves,
				p.visibility,
				p.created_at,
				LAG(p.id) OVER (ORDER BY p.created_at ASC) AS previous_id,
				LEAD(p.id) OVER (ORDER BY p.created_at ASC) AS next_id
			FROM collections_puzzles cp
			JOIN puzzles p ON p.id = cp.puzzles_id
			WHERE cp.collections_id = $1
		)
		SELECT * FROM ordered WHERE id = $2
	`

	row := db.QueryRowContext(ctx, query, collectionId, id)

	puzzle := data.Puzzle{}

	err := row.Scan(
		&puzzle.ID,
		&puzzle.Name,
		&puzzle.Fen,
		&puzzle.Moves,
		&puzzle.Visibility,
		&puzzle.CreatedAt,
		&puzzle.PreviousPuzzleId,
		&puzzle.NextPuzzleId,
	)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &puzzle, nil
}

func (db *DB) GetPuzzle(id string) (*data.Puzzle, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	query := `
		SELECT * FROM puzzles
		WHERE id = $1
	`

	puzzle := data.Puzzle{}
	err := db.GetContext(ctx, &puzzle, query, id)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, ErrRecordNotFound
		default:
			return nil, err
		}
	}

	return &puzzle, nil
}
