package main

import (
	"expvar"
	"net/http"

	"github.com/julienschmidt/httprouter"
)

func (app *application) routes() http.Handler {
	router := httprouter.New()

	router.NotFound = http.HandlerFunc(app.notFoundResponse)
	router.MethodNotAllowed = http.HandlerFunc(app.methodNotAllowedResponse)

	router.HandlerFunc(http.MethodGet, "/v1/healthcheck", app.healthcheckHandler)

	router.HandlerFunc(http.MethodGet, "/v1/me", app.getCurrentUserHandler)

	router.HandlerFunc(http.MethodPost, "/v1/users", app.registerUserHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/logout", app.logOutUserHandler)
	router.HandlerFunc(http.MethodPost, "/v1/users/change-password", app.changePasswordHandler)

	router.HandlerFunc(http.MethodPost, "/v1/tokens/authentication", app.loginHandler)
	router.HandlerFunc(http.MethodPost, "/v1/tokens/refresh", app.refreshTokensHandler)
	router.HandlerFunc(http.MethodPost, "/v1/tokens/invitecode", app.requireAdminUser(app.createInviteTokenHandler))

	router.HandlerFunc(http.MethodPost, "/v1/puzzles/import", app.requireAdminUser(app.importPuzzlePGNsHandler))
	router.HandlerFunc(http.MethodGet, "/v1/puzzles/:id", app.getPuzzleHandler)

	router.HandlerFunc(http.MethodPost, "/v1/collections", app.requireAdminUser(app.createCollectionHandler))
	router.HandlerFunc(http.MethodGet, "/v1/collections/:id", app.getCollectionHandler)

	router.Handler(http.MethodGet, "/debug/vars", expvar.Handler())

	return app.enableCORS(app.rateLimit(app.authenticate(app.parseSession(router))))
}
