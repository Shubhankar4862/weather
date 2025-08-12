import { Button } from "@/components/ui/button";

const LandingHero = () => {
  const goToWeather = () => {
    window.location.hash = "weather";
  };

  return (
    <section aria-labelledby="landing-hero" className="border-b">
      <div className="container mx-auto p-6 md:p-10 h-[100vh]">
        <h1 id="landing-hero" className="text-2xl md:text-3xl font-semibold mb-3">
          Ultra-minimal Weather App
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mb-4 max-w-2xl">
          Manage locations by ZIP or coordinates, then fetch forecasts instantly. Dark by default; warm light mode available.
        </p>
        <div className="flex justify-center items-center">
            <span>
              Welcoming u to the no bs fast weather app .
              
            </span>
          </div>
        <div className="flex gap-2">
          <a href="#weather">
          <Button onClick={goToWeather} aria-label="Open Weather Manager">
            Open Weather Manager
          </Button>

          </a>
          
          
        </div>
      </div>
    </section>
  );
};

export default LandingHero;
