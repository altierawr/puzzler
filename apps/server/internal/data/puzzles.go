package data

import (
	"time"

	"github.com/gofrs/uuid"
)

type Puzzle struct {
	ID               string    `db:"id" json:"id"`
	Name             string    `db:"name" json:"name"`
	Fen              string    `db:"fen" json:"fen"`
	Moves            string    `db:"moves" json:"moves"`
	Visibility       string    `db:"visibility" json:"visibility"`
	SolveStatus      *string   `json:"solveStatus,omitempty"`
	CreatedAt        time.Time `db:"created_at" json:"createdAt"`
	CreatedById      uuid.UUID `db:"created_by" json:"-"`
	CreatedBy        User      `json:"createdBy"`
	PreviousPuzzleId *string   `json:"previousPuzzleId"`
	NextPuzzleId     *string   `json:"nextPuzzleId"`
}
