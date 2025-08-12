const API_KEY = process.env.OPEN_WEATHER_API_KEY

function buildForecastUrl({ zip, lat, lon }) {
  if (lat && lon) {
    return `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`
  }
  if (zip) {
    return `https://api.openweathermap.org/data/2.5/forecast?zip=${zip.includes(',') ? zip : `${zip},us`}&appid=${API_KEY}&units=metric`
  }
  throw new Error('Invalid location')
}

module.exports = { buildForecastUrl }
