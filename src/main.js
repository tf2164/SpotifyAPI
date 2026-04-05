import './style.css'

import heroImg from './assets/spotifyicon.png'

document.querySelector('#app').innerHTML = `
<section id="center">

  <div class="hero">
    <nav class="top-nav">
      <a style="text-decoration: none;" class="wrapped-button" href="https://developer.spotify.com/documentation/web-api/quick-start/" target="_blank" rel="noopener noreferrer">Quick Start Guide</a>
     <button type="button" class="wrapped-button" onclick="window.location.href='http://127.0.0.1:5173/'"> Login with Spotify </button>
      </nav>
    <img src="${heroImg}" class="base" width="170" height="179">


    
    <h1>Current Spotify Wrapped</h1>


<button type="button" id="playlistViewBtn" class="wrapped-button">Create a Playlist</button>

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


<section id="playlist-view" style="display: none;">
  <button type="button" id="backHomeBtn" class="back-arrow">&#8592;</button>
  <h2 class="section-title">Your Playlist</h2>
  <div id="playlist-result"></div>
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
document.getElementById('playlistViewBtn').addEventListener('click', async () => {
  if (!storedAccessToken || !storedProfile) return

  showPlaylistView()
  const resultDiv = document.getElementById('playlist-result')
  resultDiv.innerHTML = '<p style="opacity:0.7">Creating playlist...</p>'

  try {
    const playlist = await createAppPlaylist(storedAccessToken, APP_PLAYLIST_NAME, true)
    const spotifyUrl = playlist.external_urls?.spotify
    resultDiv.innerHTML = `
      <p style="font-size:20px;margin-bottom:12px">${playlist.name}</p>
      <p style="opacity:0.75;margin-bottom:14px">Playlist created successfully.</p>
      ${spotifyUrl ? `<a href="${spotifyUrl}" target="_blank" rel="noopener noreferrer" class="wrapped-button" style="text-decoration:none;display:inline-block">Open in Spotify</a>` : ''}
    `
  } catch (error) {
    console.error('Error creating playlist:', error)
    if (isScopeError(error)) {
      await redirectToAuthCodeFlow(clientId)
      resultDiv.innerHTML = '<p style="opacity:0.7">Spotify permissions needed. Re-authorizing now. Try again after login.</p>'
      return
    }

    resultDiv.innerHTML = '<p style="opacity:0.7">Failed to create playlist.</p>'
  }
})

document.getElementById('backHomeBtn').addEventListener('click', () => {
  showHomeView()
})

const APP_PLAYLIST_NAME = 'My Recommended Mix'
const APP_PLAYLIST_DESCRIPTION = 'Generated from your Spotify Wrapped recommendations'

async function createAppPlaylist(token, name, isPublic = false) {
  return spotifyApiJson(token, 'https://api.spotify.com/v1/me/playlists', {
    method: 'POST',
    body: {
      name,
      description: APP_PLAYLIST_DESCRIPTION,
      public: isPublic
    },
    errorPrefix: 'Failed to create playlist'
  })
}

async function spotifyApiJson(token, url, options = {}) {
  const response = await spotifyApiRequest(token, url, options)
  return response.json()
}

async function spotifyApiRequest(token, url, { method = 'GET', body, errorPrefix = 'Spotify request failed' } = {}) {
  const headers = { Authorization: `Bearer ${token}` }
  const hasBody = body !== undefined

  if (hasBody) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    method,
    headers,
    body: hasBody ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const responseBody = await response.text()
    throw createSpotifyApiError(errorPrefix, response.status, responseBody)
  }

  return response
}

function getTrackUris(tracks) {
  if (!Array.isArray(tracks)) return []
  return tracks.map((track) => track?.uri).filter(Boolean)
}

function createSpotifyApiError(prefix, status, body) {
  const error = new Error(`${prefix}: ${status} ${body}`)
  error.status = status
  return error
}

function isScopeError(error) {
  return error?.status === 401 || error?.status === 403
}

const clientId = 'c2f50c92784746e387cb233c3d557b2c'
const configuredRedirectUri = 'http://127.0.0.1:5173/'

const redirectUri = configuredRedirectUri ?? `${window.location.origin}${window.location.pathname}`
let storedAccessToken = null
let storedProfile = null
let storedTopTracks = []
let storedTopArtists = []
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
  storedProfile = profile
  storedTopTracks = topTracks
  storedTopArtists = topArtists
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
  params.append('scope', 'user-read-private user-read-email user-top-read playlist-modify-private playlist-modify-public')
  params.append('show_dialog', 'true')
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

async function fetchPlaylists(token) {
  const result = await fetch('https://api.spotify.com/v1/me/playlists?limit=5', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  if (!result.ok) {
    const body = await result.text()
    throw new Error(`Failed to fetch playlists: ${result.status} ${body}`)
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


function populatePlaylists(playlists) {
  const list = document.getElementById('playlistList')
  list.innerHTML = ''

  if (!playlists.length) {
    const emptyItem = document.createElement('li')
    emptyItem.textContent = 'No playlists available.'
    list.appendChild(emptyItem)
    return
  }

  playlists.forEach((playlist, index) => {
    const item = document.createElement('li')
    item.textContent = `${index + 1}. ${playlist.name}`
    list.appendChild(item)
  })
}


function showHomeView() {
  document.getElementById('top-artists').style.display = 'flex'
  document.getElementById('top-tracks').style.display = 'flex'
  document.getElementById('playlist-view').style.display = 'none'
  document.getElementById('next-steps').style.display = 'flex'
}

function showPlaylistView() {
  document.getElementById('top-artists').style.display = 'none'
  document.getElementById('top-tracks').style.display = 'none'
  document.getElementById('playlist-view').style.display = 'flex'
  document.getElementById('next-steps').style.display = 'none'
}
