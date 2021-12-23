import axios from 'axios'
import { URLSearchParams } from 'url'
import msal, { ConfidentialClientApplication } from '@azure/msal-node'

const clientConfig = {
  auth: {
    clientId: process.env.CLIENT_ID || '',
    authority: 'https://login.microsoftonline.com/consumers/',
    clientSecret: process.env.CLIENT_SECRET || '',
  },
}
const cca = new ConfidentialClientApplication(clientConfig)

async function MicrosoftAuthUrl() {
  const authCodeUrlParameters = {
    scopes: ['Xboxlive.signin', 'offline_access'],
    redirectUri: 'http://localhost:3000/auth',
  }

  // get url to sign user in and consent to scopes needed for application
  const url = await cca.getAuthCodeUrl(authCodeUrlParameters)

  return url
}

async function AuthorizeXbox(code: string) {
  const tokenRequest = {
    code,
    redirectUri: 'http://localhost:3000/auth',
    scopes: ['Xboxlive.signin', 'offline_access'],
  }

  // acquire a token by exchanging the code
  const tokenResponse = await cca.acquireTokenByCode(tokenRequest)

  const accessToken = tokenResponse?.accessToken
  // console.log(accessToken)

  const xblUrl = 'https://user.auth.xboxlive.com/user/authenticate'
  const xblParams = {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${accessToken}`,
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT',
  }
  const xblResponse = await axios.post(xblUrl, xblParams)
  // console.log(xblResponse)

  const xstsUrl = 'https://xsts.auth.xboxlive.com/xsts/authorize'
  const xstsParams = {
    Properties: {
      SandboxId: 'RETAIL',
      UserTokens: [xblResponse.data.Token],
    },
    RelyingParty: 'http://xboxlive.com',
    TokenType: 'JWT',
  }
  const xstsResponse = await axios.post(xstsUrl, xstsParams)
  // console.log(xstsResponse)

  const xbl3Token = `XBL3.0 x=${xstsResponse.data.DisplayClaims.xui[0].uhs};${xstsResponse.data.Token}`
  // console.log(xbl3Token)

  return { notAfter: xstsResponse.data.NotAfter, xbl3Token }
}

async function GetXuid(gamertag: string, xbl3Token: string): Promise<string> {
  const xuidUrl = `https://profile.xboxlive.com/users/gt(${encodeURIComponent(
    gamertag
  )})/profile/settings`
  const xuidHeaders = {
    Authorization: xbl3Token,
    'x-xbl-contract-version': '2',
    'Content-Type': 'application/json',
  }
  const xuidResponse = await axios.get(xuidUrl, { headers: xuidHeaders })
  // console.log(xuidResponse)

  return xuidResponse.data.profileUsers[0].id || ''
}

async function GetClips(
  title: number,
  xuid: string,
  xbl3Token: string
): Promise<{}> {
  const clipsUrl = `https://gameclipsmetadata.xboxlive.com/users/xuid(${xuid})/titles/${title}/clips?maxItems=200`
  const clipsHeaders = {
    Authorization: xbl3Token,
    'x-xbl-contract-version': '2',
    'Content-Type': 'application/json',
  }
  const clipsResponse = await axios.get(clipsUrl, { headers: clipsHeaders })

  return clipsResponse.data || {}
}

export { MicrosoftAuthUrl, AuthorizeXbox, GetXuid, GetClips }
