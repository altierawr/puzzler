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

func (app *application) updatePuzzleSolveStatusHandler(w http.ResponseWriter, r *http.Request) {
	userId := app.contextGetUserId(r)
	if userId == nil {
		app.invalidAuthenticationTokenResponse(w, r)
		return
	}

	id, err := app.readIDStringParam(r)
	if err != nil {
		app.notFoundResponse(w, r)
		return
	}

	var input struct {
		Status string `json:"status"`
	}

	err = app.readJSON(w, r, &input)
	if err != nil {
		app.handleReadJSONError(w, r, err)
		return
	}

	if input.Status != "success" && input.Status != "partial" && input.Status != "fail" {
		app.badRequestResponse(w, r, errors.New("status is invalid"))
		return
	}

	err = app.db.SetPuzzleSolveStatus(id, *userId, input.Status)
	if err != nil {
		switch {
		case errors.Is(err, database.ErrRecordNotFound):
			app.notFoundResponse(w, r)
		default:
			app.serverErrorResponse(w, r, err)
		}

		return
	}

	err = app.writeJSON(w, http.StatusOK, nil, nil)
	if err != nil {
		app.serverErrorResponse(w, r, err)
	}
}

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
		PGNs []string `json:"pgns"`
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

	for _, pgn := range input.PGNs {
		puzzle := data.Puzzle{}

		scanner := bufio.NewScanner(strings.NewReader(pgn))
		finishedWithMoves := false
		comments := ""
		for scanner.Scan() {
			l := scanner.Text()
			line := strings.TrimSpace(l)

			if s, found := strings.CutPrefix(line, "[White"); found {
				split := strings.Split(s, "\"")
				if len(split) != 3 {
					app.badRequestResponse(w, r, errors.New("invalid puzzle name"))
					return
				}

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
				app.logger.Warn("puzzle was empty", "puzzle", puzzle.Name)
				puzzle = data.Puzzle{}
				break
			}

			// other tags that we don't care about
			if strings.HasPrefix(line, "[") {
				continue
			}

			if len(line) == 0 && len(puzzle.Moves) > 0 {
				finishedWithMoves = true
			}

			if len(line) == 0 {
				continue
			}

			if !finishedWithMoves {
				puzzle.Moves = puzzle.Moves + strings.ReplaceAll(line, "\n", "") + " "
			} else {
				comments = comments + line + "\n"
			}
		}

		if len(comments) > 0 {
			puzzle.Comments = &comments
		}

		if len(puzzle.Moves) > 0 {
			puzzle.CreatedById = *userID
			puzzles = append(puzzles, puzzle)
		}

		if err := scanner.Err(); err != nil {
			app.logger.Error("scan error", "err", err.Error())
			app.serverErrorResponse(w, r, err)
			return
		}
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
