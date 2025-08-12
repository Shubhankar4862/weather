import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import LandingHero from "@/components/LandingHero";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { Cloud, Thermometer, Droplet, Wind } from "lucide-react";

// const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001";
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

type Location = {
  id: number;
  zip?: string | null;
  lat?: string | null;
  lon?: string | null;
};

type WeatherEntry = {
  location: { zip?: string | null; lat?: string | null; lon?: string | null };
  place?: string | null;
  forecast?: { list: any[] };
  error?: string;
};

function parseLatLonFromGoogleMapsUrl(
  url: string
): { lat: string; lon: string } | null {
  try {
    const decoded = decodeURIComponent(url.trim());

    // 1) @lat,lon,zoom pattern
    const atMatch = decoded.match(/@(-?\d+\.\d+),(-?\d+\.\d+),/);
    if (atMatch) return { lat: atMatch[1], lon: atMatch[2] };

    // 2) q=lat,lon or ll=lat,lon
    const qMatch = decoded.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) return { lat: qMatch[1], lon: qMatch[2] };

    // 3) !3d<lat>!4d<lon> in place links
    const bangMatch = decoded.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (bangMatch) return { lat: bangMatch[1], lon: bangMatch[2] };

    // 4) Fallback: any lat,lon pair present in the string
    const pair = decoded.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (pair) return { lat: pair[1], lon: pair[2] };
  } catch {}
  return null;
}

const Index = () => {
  const [username, setUsername] = useState("");
  const [activeUser, setActiveUser] = useState<string | null>(null);

  const [zip, setZip] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [gmapsUrl, setGmapsUrl] = useState("");

  const [locations, setLocations] = useState<Location[]>([]);
  const [weather, setWeather] = useState<WeatherEntry[]>([]);

  const userSet = useMemo(() => !!activeUser, [activeUser]);

  const weatherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollToWeather = () => {
      if (window.location.hash === "#weather") {
        weatherRef.current?.scrollIntoView({
          behavior: "auto",
          block: "start",
        });
      }
    };
    // Initial check on mount
    scrollToWeather();
    // Listen for hash changes
    window.addEventListener("hashchange", scrollToWeather);
    return () => window.removeEventListener("hashchange", scrollToWeather);
  }, []);

  const applyTheme = useCallback((next: "dark" | "light") => {
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("theme", next);
  }, []);

  const toggleTheme = useCallback(() => {
    const current = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }, [applyTheme]);

  const handleSetUser = async () => {
    const u = username.trim();
    if (!u) return alert("Enter username");
    try {
      await fetch(`${API_BASE}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      setActiveUser(u);
      await loadLocations(u);
    } catch (e) {
      console.error(e);
      alert("Failed to set user");
    }
  };

  const loadLocations = async (u = activeUser) => {
    if (!u) return;
    try {
      const res = await fetch(
        `${API_BASE}/locations?username=${encodeURIComponent(u)}`
      );
      const data: Location[] = await res.json();
      setLocations(data);
    } catch (e) {
      console.error(e);
      alert("Failed to load locations");
    }
  };

  const addLocation = async () => {
    if (!activeUser) return alert("Set user first");
    const z = zip.trim();
    const la = lat.trim();
    const lo = lon.trim();
    if (!z && (!la || !lo)) return alert("Provide zip OR Coordinates 📍");
    if (z && (la || lo)) return alert("Only one type allowed");
    try {
      await fetch(`${API_BASE}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: activeUser,
          zip: z || null,
          lat: la || null,
          lon: lo || null,
        }),
      });
      setZip("");
      setLat("");
      setLon("");
      await loadLocations();
    } catch (e) {
      console.error(e);
      alert("Failed to add location");
    }
  };

  const deleteLocation = async (id: number) => {
    try {
      await fetch(`${API_BASE}/location/${id}`, { method: "DELETE" });
      await loadLocations();
    } catch (e) {
      console.error(e);
      alert("Failed to delete");
    }
  };

  const updateLocation = async (id: number) => {
    const newZip =
      window.prompt("New zip (leave blank for lat/lon update)") || "";
    const la = newZip ? null : window.prompt("New lat") || "";
    const lo = newZip ? null : window.prompt("New lon") || "";
    if (!newZip && (!la || !lo)) return alert("Provide zip OR Coordinates 📍");
    if (newZip && (la || lo)) return alert("Only one type allowed");
    try {
      await fetch(`${API_BASE}/location/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zip: newZip || null,
          lat: la || null,
          lon: lo || null,
        }),
      });
      await loadLocations();
    } catch (e) {
      console.error(e);
      alert("Failed to update");
    }
  };

  const refreshWeather = async () => {
    if (!activeUser) return alert("Set user first");
    try {
      const res = await fetch(
        `${API_BASE}/weather?username=${encodeURIComponent(activeUser)}`
      );
      const data: WeatherEntry[] = await res.json();
      setWeather(data);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch weather");
    }
  };

  const handleParseGmaps = () => {
    const parsed = parseLatLonFromGoogleMapsUrl(gmapsUrl);
    if (!parsed) return alert("Could not parse coordinates from link");
    setLat(parsed.lat);
    setLon(parsed.lon);
  };

  return (
    <div className="min-h-screen w-full">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between py-4">
          <h1 className="text-xl font-medium">noBS Weather</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              Dark - Light
            </Button>
          </div>
        </div>
      </header>

      {/* <LandingHero /> */}

      <main id="weather" ref={weatherRef} className="container mx-auto  p-4">
        {/* User Section */}
        <div className="p-6 font-mono text-2xl text-center">
          <span>Put ur stuff in here ...</span>
        </div>
        <div className="p-15"></div>
        <div className="p-10"></div>
        <section aria-labelledby="user-section" className="mb-6">
          <h2 id="user-section" className="sr-only">
            User
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSetUser()}
              aria-label="Username"
            />
            <Button onClick={handleSetUser}>Set User</Button>
          </div>
          {userSet && (
            <p className="text-sm text-muted-foreground mt-2">
              User: <span className="font-medium">{activeUser}</span>
            </p>
          )}
        </section>

        {/* Add Location */}
        <section aria-labelledby="add-location" className="mb-8">
          <h2 id="add-location" className="text-base font-medium mb-2">
            Add Location
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-2 mb-2 items-center">
            <Input
              placeholder="Zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              aria-label="Zip"
            />
            <div className="text-center text-xs md:text-sm select-none">OR</div>
            <Input
              placeholder="Lat"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              aria-label="Latitude"
            />
            <Input
              placeholder="Lon"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              aria-label="Longitude"
            />
          </div>
          <div className="flex gap-2 mb-2">
            <Button onClick={addLocation}>Add Location</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setZip("");
                setLat("");
                setLon("");
              }}
            >
              Clear
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Provide only ZIP or Coordinates 📍
          </p>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-stretch">
            <Input
              placeholder="Ex:  20.613547, 84.953907"
              value={gmapsUrl}
              onChange={(e) => setGmapsUrl(e.target.value)}
              aria-label="Google Maps URL"
            />
            <Button
              variant="secondary"
              onClick={handleParseGmaps}
              aria-label="Parse Google Maps URL"
            >
              Parse Pin
            </Button>
          </div>
        </section>

        {/* Saved Locations */}
        <section aria-labelledby="saved-locations" className="mb-8">
          <h2 id="saved-locations" className="text-base font-medium mb-2">
            Saved Locations
          </h2>
          <div className="space-y-2">
            {locations.length === 0 && (
              <p className="text-sm text-muted-foreground">No locations yet.</p>
            )}
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between border p-2"
              >
                <div className="text-sm">
                  <span className="font-mono">ID: {loc.id}</span>
                  <span className="ml-2">ZIP: {loc.zip || ""}</span>
                  <span className="ml-2">LAT: {loc.lat || ""}</span>
                  <span className="ml-2">LON: {loc.lon || ""}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => updateLocation(loc.id)}
                  >
                    Update
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteLocation(loc.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <section className="mb-6">
          <Button onClick={refreshWeather}>Refresh Weather</Button>
        </section>

        {/* Weather Results */}
        <section aria-labelledby="weather-forecasts" className="mb-12">
          <h2 id="weather-forecasts" className="text-base font-medium mb-2">
            5 Day Weather Forecasts
          </h2>
          <div className="space-y-4">
            {weather.map((entry, idx) => {
  const label =
    entry.place ||
    entry.location.zip ||
    `${entry.location.lat},${entry.location.lon}`;

  if (entry.error) {
    return (
      <article
        key={idx}
        className="border border-gray-700 rounded-md bg-[#000000] h-[450px] flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b border-gray-700 shrink-0">
          <h3 className="text-lg font-semibold text-gray-100">{label}</h3>
        </div>
        <div className="p-4 text-red-500 overflow-auto flex-1 min-h-0">{entry.error}</div>
      </article>
    );
  }

  return (
    <article
  key={idx}
  className="border border-gray-700 rounded-md bg-[#000000] h-[450px] flex flex-col overflow-hidden"
>
  <div className="p-4 border-b border-gray-700 shrink-0">
    <h3 className="text-xl font-semibold text-gray-100">{label}</h3>
  </div>

  <ScrollArea.Root className="flex-1 min-h-0 w-full">
    <ScrollArea.Viewport className="h-full w-full p-4 space-y-3 overflow-y-auto">
      {entry.forecast.list.map((forecastItem, i) => (
        <div
          key={i}
          className="rounded-md p-3 bg-[#111111] border border-gray-800 flex flex-col space-y-1"
        >
          <time className="text-xs text-gray-400 font-mono">
            {new Date(forecastItem.dt * 1000).toLocaleString()}
          </time>
          <div className="flex items-center space-x-2 text-gray-100 text-sm">
            <Thermometer size={16} />
            <span>{forecastItem.main.temp} °C</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-300 text-sm capitalize">
            <Cloud size={16} />
            <span>{forecastItem.weather[0].description}</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400 text-xs font-mono">
            <Droplet size={14} />
            <span>{forecastItem.main.humidity}% humidity</span>
          </div>
          <div className="flex items-center space-x-2 text-gray-400 text-xs font-mono">
            <Wind size={14} />
            <span>{forecastItem.wind.speed} m/s wind</span>
          </div>
        </div>
      ))}
    </ScrollArea.Viewport>
    <ScrollArea.Scrollbar orientation="vertical" className="bg-gray-900 w-2 rounded-full" />
    <ScrollArea.Corner />
  </ScrollArea.Root>
</article>

  );
})}


          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container mx-auto py-4 text-xs text-muted-foreground">
          Ultra-fast, minimal UI. Dark by default.
          <div className="p-2"></div>
          <span>crafted by sp4ss</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
