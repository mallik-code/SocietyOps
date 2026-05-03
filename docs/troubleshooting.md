# Troubleshooting

This document provides solutions for common issues encountered when setting up or running SocietyOps.

---

### Evolution API not starting
The evolution service depends on Postgres being healthy. Check `docker compose logs postgres`.
If the volume is corrupt: `docker compose down -v && docker compose up --build`.

### WhatsApp QR code not appearing
Open http://localhost:8080 directly and use the Evolution API dashboard. Or use the `/connect`
page in the React dashboard which fetches the QR via the api-server.

### Messages not being received
1.  Check `docker compose logs evolution` for connection status.
2.  Verify `EVOLUTION_API_KEY` matches in both `.env` and `docker-compose.yml`.
3.  Confirm the webhook is registered. Check `api-server` logs for "Syncing webhook". Evolution v2 requires `enabled: true`.
4.  Check if you are using Evolution API v2 (uppercase `MESSAGES_UPSERT`) or v1 (lowercase `messages.upsert`). The current `api-server` handles both.
5.  Check `api-server` logs for "Evolution Webhook Request Body" to see if data is arriving.

### Tickets not being created (no AI errors)
Check `MIN_CONFIDENCE` — if the message has low confidence the policy engine skips ticket creation.
Use `/policy/simulate` to dry-run a message and see which phase rejected it.

### Dashboard shows no data
The dashboard fetches from the Express api-server (port 3001) which in turn proxies to FastAPI.
Check that api-server is healthy: `curl http://localhost:3001/api/healthz`.

### Port conflicts
Change host ports in `.env`: `DASHBOARD_PORT`, `API_SERVER_PORT`. The Evolution API port (8080)
is set in `docker-compose.yml` directly.
