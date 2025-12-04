# @sip-protocol/api

> **Warning: NOT PRODUCTION READY**
>
> This API package is intended for development and testing purposes only. Before production deployment:
> - Replace in-memory swap tracking with a database (PostgreSQL, Redis, or MongoDB)
> - Integrate real quote providers instead of mock data
> - Add proper authentication and API key management
> - Set explicit CORS origins (never use `*` in production)

REST API service for SIP Protocol SDK - Optional wrapper for non-JavaScript backends.

## Overview

This package provides a REST API wrapper around the `@sip-protocol/sdk`, allowing non-JavaScript applications to interact with the SIP Protocol through HTTP requests.

## Features

- RESTful API endpoints for all core SDK functionality
- Request validation with Zod schemas
- Comprehensive error handling
- OpenAPI documentation
- Docker support for easy deployment
- Production-ready security (Helmet, CORS, rate limiting)

## Installation

```bash
pnpm install
```

## Development

```bash
# Start development server with hot reload
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## API Endpoints

### Health Check
- `GET /api/v1/health` - Service health check

### Stealth Addresses
- `POST /api/v1/stealth/generate` - Generate stealth address

### Commitments
- `POST /api/v1/commitment/create` - Create Pedersen commitment

### Proofs
- `POST /api/v1/proof/funding` - Generate funding proof

### Swaps
- `POST /api/v1/quote` - Get swap quote
- `POST /api/v1/swap` - Execute swap
- `GET /api/v1/swap/:id/status` - Get swap status

## Usage Examples

### Generate Stealth Address

```bash
curl -X POST http://localhost:3000/api/v1/stealth/generate \
  -H "Content-Type: application/json" \
  -d '{
    "chain": "ethereum",
    "recipientMetaAddress": {
      "spendingKey": "0x02...",
      "viewingKey": "0x03...",
      "chain": "ethereum"
    }
  }'
```

### Create Commitment

```bash
curl -X POST http://localhost:3000/api/v1/commitment/create \
  -H "Content-Type: application/json" \
  -d '{
    "value": "1000000000"
  }'
```

### Get Swap Quote

```bash
curl -X POST http://localhost:3000/api/v1/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputChain": "ethereum",
    "inputToken": "ETH",
    "inputAmount": "1000000000000000000",
    "outputChain": "solana",
    "outputToken": "SOL",
    "slippageTolerance": 1
  }'
```

## Docker Deployment

```bash
# Build image
docker build -t sip-api .

# Run container
docker run -p 3000:3000 -e NODE_ENV=production sip-api

# With environment variables
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e CORS_ORIGIN=https://example.com \
  sip-api
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `CORS_ORIGIN` - CORS allowed origins (default: *)

## Response Format

All endpoints return responses in the following format:

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  }
}
```

## Error Codes

- `VALIDATION_ERROR` - Invalid request parameters
- `NOT_FOUND` - Resource not found
- `INTERNAL_SERVER_ERROR` - Unexpected server error
- SDK-specific error codes from `@sip-protocol/sdk`

## Architecture

```
src/
├── routes/          # API route handlers
│   ├── health.ts    # Health check
│   ├── stealth.ts   # Stealth address generation
│   ├── commitment.ts # Pedersen commitments
│   ├── proof.ts     # ZK proof generation
│   └── swap.ts      # Swap quotes and execution
├── middleware/      # Express middleware
│   ├── validation.ts    # Request validation
│   └── error-handler.ts # Error handling
├── types/          # TypeScript types
│   └── api.ts      # API request/response types
└── server.ts       # Main server setup
```

## Production Considerations

1. **Database**: The in-memory swap tracking should be replaced with a proper database (PostgreSQL, MongoDB, etc.)
2. **Authentication**: Add API key or JWT authentication for production use
3. **Rate Limiting**: Consider adding rate limiting middleware
4. **Logging**: Use structured logging (e.g., Winston, Pino) for production
5. **Monitoring**: Add APM tools (e.g., New Relic, Datadog)
6. **Load Balancing**: Deploy behind a load balancer for high availability

## License

MIT
