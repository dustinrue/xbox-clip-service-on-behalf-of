import axios from 'axios'
import { URLSearchParams } from 'url'

async function AuthorizeXbox(appAccessToken: string): Promise<string> {
  const swapTokenUrl =
    'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
  const swapTokenParams = new URLSearchParams()
  swapTokenParams.append(
    'grant_type',
    'urn:ietf:params:oauth:grant-type:jwt-bearer'
  )
  swapTokenParams.append('client_id', process.env.CLIENT_ID || '')
  swapTokenParams.append('client_secret', process.env.CLIENT_SECRET || '')
  swapTokenParams.append('assertion', appAccessToken || '')
  swapTokenParams.append('scope', 'XboxLive.signin offline_access')
  swapTokenParams.append('requested_token_use', 'on_behalf_of')

  const swapTokenResponse = await axios.post(swapTokenUrl, swapTokenParams)
  // console.log(swapTokenResponse)

  const xblUrl = 'https://user.auth.xboxlive.com/user/authenticate'
  const xblParams = {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${swapTokenResponse.data.access_token}`,
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

  return xbl3Token
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

export { AuthorizeXbox, GetXuid, GetClips }
