package main

import (
	"bufio"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/altierawr/puzzler/internal/data"
	"github.com/altierawr/puzzler/internal/database"
)

func (app *application) getPuzzleHandler(w http.ResponseWriter, r *http.Request) {
	id, err := app.readIDStringParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	puzzle, err := app.db.GetPuzzle(id)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}

		return
	}

	err = app.writeJSON(w, http.StatusOK, puzzle, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

func (app *application) importPuzzlePGNsHandler(w http.ResponseWriter, r *http.Request) {
	userID := app.contextGetUserId(r)
	if userID == nil {
		app.invalidAuthenticationTokenResponse(w, r)
		return
	}

	var input struct {
		PGNs string `json:"pgns"`
	}

	err := app.readJSON(w, r, &input)
	if err != nil {
		app.handleReadJSONError(w, r, err)
		return
	}

	// reader := strings.NewReader(input.PGNs)
	// // just do this to check for errors
	// _, err = chess.GamesFromPGN(reader)
	// if err != nil {
	// 	app.badRequestResponse(w, r, err)
	// 	fmt.Println(err)
	// 	return
	// }

	puzzles := []data.Puzzle{}

	puzzle := data.Puzzle{}

	scanner := bufio.NewScanner(strings.NewReader(input.PGNs + "\n\n"))
	for scanner.Scan() {
		l := scanner.Text()
		line := strings.TrimSpace(l)

		if len(line) == 0 || line == "\n" {
			// check if we reached the end of the pgn
			if len(puzzle.Moves) > 0 {
				puzzle.CreatedById = *userID
				puzzles = append(puzzles, puzzle)
				puzzle = data.Puzzle{}
			}

			continue
		}

		if strings.HasPrefix(line, "[") && len(puzzle.Moves) > 0 {
			puzzle.CreatedById = *userID
			puzzles = append(puzzles, puzzle)
			puzzle = data.Puzzle{}
		}

		if s, found := strings.CutPrefix(line, "[White"); found {
			split := strings.Split(s, "\"")
			if len(split) != 3 {
				app.badRequestResponse(w, r, errors.New("invalid puzzle name"))
				return
			}

			fmt.Println("found puzzle", split[1])
			puzzle.Name = split[1]
		}

		if s, found := strings.CutPrefix(line, "[FEN"); found {
			split := strings.Split(s, "\"")
			if len(split) != 3 {
				app.badRequestResponse(w, r, errors.New("invalid puzzle fen"))
				return
			}

			puzzle.Fen = split[1]
		}

		// blank puzzle
		if line == "*" && len(puzzle.Moves) == 0 {
			puzzle = data.Puzzle{}
			continue
		}

		// other tags that we don't care about
		if strings.HasPrefix(line, "[") {
			continue
		}

		puzzle.Moves = puzzle.Moves + strings.ReplaceAll(line, "\n", "") + " "
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("scan error:", err)
		app.serverErrorResponse(w, r, err)
		return
	}

	fmt.Println("found", len(puzzles), "puzzles")
	err = app.db.InsertPuzzles(puzzles)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		fmt.Println(err)
		return
	}

	err = app.writeJSON(w, http.StatusOK, puzzles, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
