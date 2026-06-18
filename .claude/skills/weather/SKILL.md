---
name: weather
description: >
  Fetches today's, tomorrow's, and the day-after-tomorrow's detailed weather
  (temperature, conditions, wind, humidity, precipitation chance) for a city.
  Defaults to Santa Cruz de la Sierra, Bolivia if no city is given.
  Use when the user asks for the weather, forecast, or invokes /weather.
---

Get a detailed 3-day weather report (today, tomorrow, day after tomorrow) for the requested city.

## City

- If the user passed a city in `$ARGUMENTS`, use that city.
- Otherwise default to **Santa Cruz de la Sierra, Bolivia**.

## Steps

1. Use `WebSearch` with a query like `"<city> weather forecast today tomorrow"` to find current conditions and the short-term forecast. Prefer results from weather.com, AccuWeather, or Weather Underground.
2. If the search results don't give enough detail for all three days (today/tomorrow/day after), follow up with `WebFetch` on the most relevant forecast page (e.g. a weather.com or AccuWeather forecast URL from the search results) to extract per-day detail.
3. Build a report covering exactly three days: **today**, **tomorrow**, and **the day after tomorrow**. For each day include:
   - General condition (sunny, cloudy, rain, storms, etc.)
   - High / low temperature (°C, with °F in parentheses)
   - Chance of precipitation
   - Wind (speed + direction)
   - Humidity, if available

## Output format

Reply in Spanish, organized as one section per day:

```
## Hoy (<fecha>)
- Condición: ...
- Temperatura: máx X°C / mín Y°C
- Probabilidad de lluvia: ...
- Viento: ...
- Humedad: ...

## Mañana (<fecha>)
...

## Pasado mañana (<fecha>)
...
```

End the response with a `Sources:` section listing the markdown-hyperlinked URLs used, per the WebSearch tool's citation requirement.
