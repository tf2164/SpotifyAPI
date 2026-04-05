# Current Spotify Wrapped Web App

## Overview
This project uses the Spotify API to display user data.

It currently shows:
- Top 5 Tracks
- Top 5 Artists

---

## Features
- Fetches data from Spotify API using GET requests  
- Displays:
  - Top 5 Tracks  
  - Top 5 Artists  
- Navigation between pages:
 
- Each navigation triggers a new API call

---

## How It Works
- Two endpoints are used:
  - `/me/top/tracks`
  - `/me/top/artists`
- When a page loads, a GET request is made to the corresponding endpoint
- Clicking navigation links loads the other dataset and makes a new request

---

## Running the Project

### 1. Clone the repo
```bash
git clone <your-repo-link>
cd <your-project-folder>
