Assessment by
- Shubhankar Mahanta (sp4s-s)

Security & features
- SSL Certificate Enabled
- DB Postgress Access with CA certs only
- Vercel Ready with root level monorepo
- Full stack with CRUD
- Currently deployed on separate platforms
    - Backend (Render.com)
    - Frontend (Vercel.com)
    - Deployment Security enabled


Live view - (Weather)[]
- (Live_view)[https://weather.spass.uk]
- (Production)[https://weather-front-sand.vercel.app]


May need some tweaking for early preview bare html
- (Follow on here)[https://github.com/sp4s-s/the-weather-thing]
- (Broken)(https://github.com/sp4s-s/pm-weather)


### Run
```shell
cd server
# vercel ready
nodemon api/full.js
```
frontend (change the API_BASE) 
```
cd weather-vue
pnpm dev
```

```
change these to point to backend endpoint .
// const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const API_BASE = "https://wea-2af3.onrender.com";
```
