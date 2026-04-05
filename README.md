# Current Spotify Wrapped Web App
##[Deployed link]()
## Overview
This project uses the Spotify API to display user data.

It currently shows:
- Top 5 Tracks
- Top 5 Artists
- Top 5 Recommended songs

---

## Features
- Fetches data from Spotify API using GET requests  
- Displays:
  - Top 5 Tracks  
  - Top 5 Artists  
- Navigation between views:
 - Top 5 recommended songs with button to create playlist

---

## How It Works
- Endpoints used:
  - `/me/top/tracks`
  - `/me/top/artists`
  - `/me/top/playlists`
- When a page loads, a GET request is made to the corresponding endpoint
- Clicking navigation links loads the other dataset and makes a new request

---

## Running the Project

### 1. Clone the repo
```bash
git clone <your-repo-link>
cd <your-project-folder>
