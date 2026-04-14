import { GoogleAuth } from 'google-auth-library'
import { getVercelOidcToken } from '@vercel/functions/oidc'

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID
const GA4_API = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`

export async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GCP_SA_KEY_JSON

  if (keyJson) {
    const auth = new GoogleAuth({
      credentials: JSON.parse(keyJson),
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    })
    const client = await auth.getClient()
    const { token } = await client.getAccessToken()
    if (!token) throw new Error('Failed to get access token')
    return token
  }

  const projectNumber = process.env.GCP_PROJECT_NUMBER
  const poolId = process.env.GCP_WORKLOAD_IDENTITY_POOL_ID
  const providerId = process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID
  const serviceAccountEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL

  if (projectNumber && poolId && providerId && serviceAccountEmail && process.env.VERCEL) {
    const oidcToken = await getVercelOidcToken()
    const stsUrl = 'https://sts.googleapis.com/v1/token'
    const audience = `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`

    const stsRes = await fetch(stsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        audience,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        subject_token: oidcToken,
      }),
    })
    if (!stsRes.ok) {
      const errText = await stsRes.text()
      throw new Error(`STS token exchange failed: ${stsRes.status} ${errText.slice(0, 200)}`)
    }
    const stsData = await stsRes.json()

    const impersonateUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`
    const impRes = await fetch(impersonateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stsData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scope: [
          'https://www.googleapis.com/auth/analytics.readonly',
          'https://www.googleapis.com/auth/cloud-platform',
          'https://www.googleapis.com/auth/webmasters.readonly',
        ],
      }),
    })
    if (!impRes.ok) {
      const errText = await impRes.text()
      throw new Error(`SA impersonation failed: ${impRes.status} ${errText.slice(0, 200)}`)
    }
    const impData = await impRes.json()
    return impData.accessToken
  }

  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    projectId: 'project-150ad5c5-0e90-4383-9bc',
  })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) throw new Error('Failed to get access token')
  return token
}

export async function runGA4Report(accessToken: string, body: object) {
  const res = await fetch(GA4_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GA4 API ${res.status}: ${text.slice(0, 1000)}`)
  }
  return res.json()
}
