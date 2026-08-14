import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchPlacesTool from "./tools/search-places";
import geocodePlaceTool from "./tools/geocode-place";
import getWeatherTool from "./tools/get-weather";
import listSavedLocationsTool from "./tools/list-saved-locations";
import saveLocationTool from "./tools/save-location";
import listBusinessListingsTool from "./tools/list-business-listings";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "my-github-hub",
  title: "My GitHub Hub",
  version: "0.1.0",
  instructions:
    "Travel and local-discovery tools for this app. Use `geocode_place` to turn a city or address into coordinates, " +
    "then `search_places` for nearby restaurants, cafes, ATMs, gas stations, hotels and more (ranked by distance), " +
    "and `get_weather_forecast` for conditions. For the signed-in user, `list_saved_locations` and `save_location` " +
    "manage their saved places, and `list_my_business_listings` returns the businesses they own.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchPlacesTool,
    geocodePlaceTool,
    getWeatherTool,
    listSavedLocationsTool,
    saveLocationTool,
    listBusinessListingsTool,
  ],
});
