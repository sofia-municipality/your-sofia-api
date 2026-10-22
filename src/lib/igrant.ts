/**
 * iGrant.io Data Wallet API client.
 *
 * Server-only. The API key must never be exposed to the mobile app — see
 * IMPLEMENTATION_PLAN.md (your-sofia-mobile), Epic 10 "Architecture — Who
 * Talks to Whom" for why: this backend owns eligibility/consent logic and
 * talks to iGrant's Admin/Issuer API with the key; the mobile wallet talks
 * directly to iGrant's issuer/verifier endpoints for the actual OpenID4VCI/
 * OpenID4VP handshake (DID/JWK stay on-device).
 *
 * Auth: `Authorization: ApiKey <key>` (per
 * docs.igrant.io/docs/extensions-api/igrant-io-api-documentation).
 *
 * `createCredentialDefinition` and `issueCredential` are typed and ready,
 * but intentionally not wired into any endpoint yet — issuing a real PID
 * credential requires the Stage 1 questions in IMPLEMENTATION_PLAN.md
 * (source of truth for identity data, eIDAS2/EUDI issuer eligibility) to be
 * resolved first. Only `listCredentialDefinitions` (a safe, read-only call)
 * is currently exercised, by `igrantTestConnection`.
 */

export class IgrantApiError extends Error {
  status: number
  body: unknown

  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.name = 'IgrantApiError'
    this.status = status
    this.body = body
  }
}

export class IgrantConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IgrantConfigError'
  }
}

function getConfig(): { baseUrl: string; apiKey: string } {
  const baseUrl = process.env.IGRANT_API_BASE_URL
  const apiKey = process.env.IGRANT_API_KEY

  if (!baseUrl) {
    throw new IgrantConfigError('IGRANT_API_BASE_URL is not configured')
  }

  if (!apiKey) {
    throw new IgrantConfigError('IGRANT_API_KEY is not configured')
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey }
}

type IgrantRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
  sandboxOrgId?: string
}

async function igrantFetch<T>(path: string, options: IgrantRequestOptions = {}): Promise<T> {
  const { baseUrl, apiKey } = getConfig()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${baseUrl}${normalizedPath}`)

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `ApiKey ${apiKey}`,
    Accept: 'application/json',
  }

  if (options.sandboxOrgId) {
    headers['X-SandboxOrgId'] = options.sandboxOrgId
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const text = await response.text()
  const parsed = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new IgrantApiError(
      `iGrant API request failed: ${response.status} ${response.statusText}`,
      response.status,
      parsed
    )
  }

  return parsed as T
}

// ─── List credential definitions (safe, read-only) ────────────────────────

export interface IgrantCredentialDefinitionSummary {
  id: string
  credentialDefinitionId: string
  label: string
  createdAt: number
  updatedAt: number
}

export interface ListCredentialDefinitionsResult {
  credentialDefinition: IgrantCredentialDefinitionSummary[] | null
  pagination?: {
    currentPage: number
    totalItems: number
    totalPages: number
    limit: number
    hasPrevious: boolean
    hasNext: boolean
  }
  issuanceHistoryStats?: {
    total: number
    accepted: number
    inProgress: number
    revoked: number
    denied: number
  }
}

export async function listCredentialDefinitions(options?: {
  offset?: number
  limit?: number
  search?: string
  skipCounts?: boolean
}): Promise<ListCredentialDefinitionsResult> {
  return igrantFetch<ListCredentialDefinitionsResult>(
    '/v2/config/digital-wallet/openid/sdjwt/credential-definitions',
    {
      method: 'GET',
      query: {
        offset: options?.offset ?? 0,
        limit: options?.limit ?? 10,
        search: options?.search ?? '',
        sortOrder: 'desc',
        skipCounts: options?.skipCounts ?? true,
      },
    }
  )
}

// ─── Create credential definition (not yet wired up — see file header) ────

export interface CreateSdJwtCredentialDefinitionInput {
  label: string
  credentialDefinitions: Array<{
    label?: string
    credentialFormat: 'dc+sd-jwt'
    /** e.g. 'urn:eu.europa.ec.eudi:pid:1' for PID (EWC RFC003) */
    vct: string
    claims: Array<{ path: string[]; mandatory?: boolean; limitDisclosure?: boolean }>
    expirationInDays?: number
  }>
  version?: 'version_01'
}

export async function createCredentialDefinition(
  input: CreateSdJwtCredentialDefinitionInput
): Promise<unknown> {
  return igrantFetch('/v2/config/digital-wallet/openid/sdjwt/credential-definition', {
    method: 'POST',
    body: { ...input, version: input.version ?? 'version_01' },
  })
}

// ─── Issue credential (not yet wired up — see file header) ────────────────

export interface IssueSdJwtCredentialInput {
  issuanceMode: 'InTime' | 'Deferred'
  credentialDefinitionId: string
  credentials: Array<{ id?: string; claims: Record<string, unknown> }>
  /** Pre-Authorized Code Flow tx_code. Leave empty for Authorisation Code Flow. */
  userPin?: string
  /** Non-OID4VCI extension — sends the offer directly to a known individual's device. */
  individualId?: string
}

export async function issueCredential(input: IssueSdJwtCredentialInput): Promise<unknown> {
  return igrantFetch('/v2/config/digital-wallet/openid/sdjwt/credential/issue', {
    method: 'POST',
    body: input,
  })
}
