import './style.css'

import heroImg from './assets/spotifyicon.png'

document.querySelector('#app').innerHTML = `
<section id="center">
  <div class="hero">
    <img src="${heroImg}" class="base" width="170" height="179">


    
    <h1>Current Spotify Wrapped</h1>

      <button type="button" class="wrapped-button" onclick="window.location.href='http://127.0.0.1:5173/'"> See my Wrapped </button>

    <div class ="app-container">
    <div class="grid-container">
    <section id="top-artists" class="section">

    <h3 class="section-title">Top Artists</h3>

  <ul id="topArtistsList" class="list" style="list-style-type: none;"></ul>
</section>

<section id="top-tracks" class="section">

    <h3 class="section-title">Top Tracks</h3>

  <ul id="topTracksList" class="list" style="list-style-type: none;"></ul>
</section>
</div>
</div>


  <div></div>
</section>

<div class="ticks"></div>

<section id="next-steps">
  <div id="docs">
    Used the <a href="https://developer.spotify.com/documentation/web-api/">Spotify Web API</a>
    to fetch and display your profile information.
  </div>
  <div id="social">
    <section id="profile">
      <h2>Logged in as <span id="displayName"></span></h2>
      <span id="avatar"></span>
      <ul>
        <li>User ID: <span id="id"></span></li>
        <li>Email: <span id="email"></span></li>
        <li>Spotify URI: <a id="uri" href="#"></a></li>
        <li>Link: <a id="url" href="#"></a></li>
      </ul>
    </section>
  </div>
</section>

<div class="ticks"></div>
<section id="spacer"></section>
`

const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const configuredRedirectUri = import.meta.env.VITE_SPOTIFY_REDIRECT_URI

if (!clientId) {
  throw new Error('Missing VITE_SPOTIFY_CLIENT_ID. Add it to your .env file.')
}

const redirectUri = configuredRedirectUri ?? `${window.location.origin}${window.location.pathname}`
let storedAccessToken = null
let isAuthInitialized = false

async function initAuth() {
  if (isAuthInitialized) return
  isAuthInitialized = true

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')

  if (!code) {
    redirectToAuthCodeFlow(clientId)
    return
  }

  storedAccessToken = await getAccessToken(clientId, code)

  const [profile, topArtists, topTracks] = await Promise.all([
    fetchProfile(storedAccessToken),
    fetchTopArtists(storedAccessToken),
    fetchTopTracks(storedAccessToken)
  ])

  populateUI(profile)
  populateTopArtists(topArtists)
  populateTopTracks(topTracks)

  // Remove auth query params after successful login so refreshes are stable.
  window.history.replaceState({}, document.title, window.location.pathname)
}

initAuth().catch((error) => {
  console.error('Auth initialization failed:', error)
})

export async function redirectToAuthCodeFlow(clientId) {
  const verifier = generateCodeVerifier(128)
  const challenge = await generateCodeChallenge(verifier)

  localStorage.setItem('verifier', verifier)

  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('response_type', 'code')
  params.append('redirect_uri', redirectUri)
  params.append('scope', 'user-read-private user-read-email user-top-read')
  params.append('code_challenge_method', 'S256')
  params.append('code_challenge', challenge)

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`
}

function generateCodeVerifier(length) {
  let text = ''
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

  for (let i = 0; i < length; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length))
  }
  return text
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier)
  const digest = await window.crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function getAccessToken(clientId, code) {
  const verifier = localStorage.getItem('verifier')
  if (!verifier) {
    throw new Error('Missing PKCE code verifier in localStorage.')
  }

  const params = new URLSearchParams()
  params.append('client_id', clientId)
  params.append('grant_type', 'authorization_code')
  params.append('code', code)
  params.append('redirect_uri', redirectUri)
  params.append('code_verifier', verifier)

  const result = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  if (!result.ok) {
    const body = await result.text()
    throw new Error(`Failed to exchange auth code: ${result.status} ${body}`)
  }

  const { access_token } = await result.json()
  return access_token
}

async function fetchProfile(token) {
  const result = await fetch('https://api.spotify.com/v1/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!result.ok) {
    const body = await result.text()
    throw new Error(`Failed to fetch profile: ${result.status} ${body}`)
  }

  return result.json()
}

function refreshProfile() {
  if (!storedAccessToken) {
    console.error('No access token available. Please authorize first.')
    return
  }

  Promise.all([
    fetchProfile(storedAccessToken),
    fetchTopArtists(storedAccessToken),
    fetchTopTracks(storedAccessToken)
  ])
    .then(([profile, topArtists, topTracks]) => {
      populateUI(profile)
      populateTopArtists(topArtists)
      populateTopTracks(topTracks)
    })
    .catch((error) => {
      console.error('Error refreshing profile:', error)
    })
}

window.refreshProfile = refreshProfile

async function fetchTopArtists(token) {
  const result = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=5', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!result.ok) {
    const body = await result.text()
    throw new Error(`Failed to fetch top artists: ${result.status} ${body}`)
  }

  const data = await result.json()
  return data.items ?? []
}

async function fetchTopTracks(token) {
  const result = await fetch('https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=5', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!result.ok) {
    const body = await result.text()
    throw new Error(`Failed to fetch top tracks: ${result.status} ${body}`)
  }

  const data = await result.json()
  return data.items ?? []
}

function populateUI(profile) {
  const safeProfile = profile ?? {}
  const avatarContainer = document.getElementById('avatar')
  const uriElement = document.getElementById('uri')
  const urlElement = document.getElementById('url')
  const profileImages = Array.isArray(safeProfile.images) ? safeProfile.images : []
  const primaryImage = profileImages[0]
  const spotifyUrl = safeProfile.external_urls?.spotify

  document.getElementById('displayName').innerText = safeProfile.display_name ?? ''
  avatarContainer.innerHTML = ''
  if (primaryImage?.url) {
    const profileImage = new Image(200, 200)
    profileImage.src = primaryImage.url
    avatarContainer.appendChild(profileImage)
  }

  document.getElementById('id').innerText = safeProfile.id ?? ''
  document.getElementById('email').innerText = safeProfile.email ?? ''
  uriElement.innerText = safeProfile.uri ?? ''

  if (spotifyUrl) {
    uriElement.setAttribute('href', spotifyUrl)
  } else {
    uriElement.removeAttribute('href')
  }

  urlElement.innerText = safeProfile.href ?? ''
  if (safeProfile.href) {
    urlElement.setAttribute('href', safeProfile.href)
  } else {
    urlElement.removeAttribute('href')
  }
}

function populateTopArtists(artists) {
  const list = document.getElementById('topArtistsList')
  list.innerHTML = ''

  if (!artists.length) {
    const emptyItem = document.createElement('li')
    emptyItem.textContent = 'No top artists available.'
    list.appendChild(emptyItem)
    return
  }

  artists.forEach((artist, index) => {
    const item = document.createElement('li')
    item.textContent = `${index + 1}. ${artist.name}`
    list.appendChild(item)
  })
}

function populateTopTracks(tracks) {
  const list = document.getElementById('topTracksList')
  list.innerHTML = ''

  if (!tracks.length) {
    const emptyItem = document.createElement('li')
    emptyItem.textContent = 'No top tracks available.'
    list.appendChild(emptyItem)
    return
  }

  tracks.forEach((track, index) => {
    const item = document.createElement('li')
    item.textContent = `${index + 1}. ${track.name}`
    list.appendChild(item)
  })
}
