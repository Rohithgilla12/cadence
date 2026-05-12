// Package auth verifies Firebase ID tokens and resolves them to a local user.
// First authenticated request for a new firebase_uid implicitly creates the
// users row. See CLAUDE.md "Auth flow" and PRD §11.
package auth
