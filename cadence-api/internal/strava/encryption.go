// Package strava is the server-side adapter for Strava OAuth, webhook
// ingest, and per-user activity sync. PRD §9 spec.
package strava

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

// Cipher wraps a 32-byte AES-GCM key for encrypting and decrypting OAuth
// tokens at rest. Stored in DB as base64(<12-byte nonce> || <ciphertext>)
// so a leak of the encrypted column alone is unrecoverable.
//
// Key source: STRAVA_TOKEN_ENCRYPTION_KEY (64 hex chars = 32 raw bytes).
// Generate one with: openssl rand -hex 32
type Cipher struct {
	gcm cipher.AEAD
}

// NewCipher accepts the hex-encoded 32-byte key from env and returns a
// reusable Cipher. Validates length up front so a misconfigured key
// fails at boot, not on first encrypt call.
func NewCipher(hexKey string) (*Cipher, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("decode strava encryption key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("strava encryption key must be 32 bytes (64 hex chars), got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("aes new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm new: %w", err)
	}
	return &Cipher{gcm: gcm}, nil
}

// Encrypt produces a base64 string safe to store in a text column. Each
// call generates a fresh random nonce — nonce reuse with the same key
// is the one thing that breaks AES-GCM, so we never derive nonces from
// user IDs or timestamps.
func (c *Cipher) Encrypt(plaintext string) (string, error) {
	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("read nonce: %w", err)
	}
	ct := c.gcm.Seal(nil, nonce, []byte(plaintext), nil)
	combined := make([]byte, 0, len(nonce)+len(ct))
	combined = append(combined, nonce...)
	combined = append(combined, ct...)
	return base64.StdEncoding.EncodeToString(combined), nil
}

// Decrypt reverses Encrypt. Returns an error rather than partial data
// on any tamper / mismatch so the caller can fail the request cleanly.
func (c *Cipher) Decrypt(encoded string) (string, error) {
	combined, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("decode token: %w", err)
	}
	nonceSize := c.gcm.NonceSize()
	if len(combined) < nonceSize {
		return "", errors.New("ciphertext shorter than nonce")
	}
	nonce, ct := combined[:nonceSize], combined[nonceSize:]
	pt, err := c.gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return "", fmt.Errorf("gcm open: %w", err)
	}
	return string(pt), nil
}
