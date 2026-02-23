package com.kipita.data.api

import com.squareup.moshi.Json
import com.squareup.moshi.JsonClass
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.Query

// ---------------------------------------------------------------------------
// Yelp Fusion API — real-time Places + Advisory integration
// Endpoint: https://api.yelp.com/v3/
// Auth: Bearer token in Authorization header
// ---------------------------------------------------------------------------

interface YelpApiService {

    /**
     * Search businesses by category near a lat/lon. Used for the 9-grid
     * Places dashboard (police, hospitals, restaurants, EV, ATMs, etc.)
     */
    @GET("businesses/search")
    suspend fun searchBusinesses(
        @Header("Authorization") bearerToken: String,
        @Query("latitude") latitude: Double,
        @Query("longitude") longitude: Double,
        @Query("categories") categoryAlias: String,
        @Query("open_now") openNow: Boolean = true,
        @Query("limit") limit: Int = 20,
        @Query("sort_by") sortBy: String = "distance",
        @Query("attributes") attributes: String? = null
    ): YelpSearchResponse

    /**
     * Search by location string (city, address, state, country, ZIP, etc.)
     * Used when user types a location manually or GPS is not available.
     */
    @GET("businesses/search")
    suspend fun searchBusinessesByLocation(
        @Header("Authorization") bearerToken: String,
        @Query("location") location: String,
        @Query("categories") categoryAlias: String,
        @Query("open_now") openNow: Boolean = true,
        @Query("limit") limit: Int = 20,
        @Query("sort_by") sortBy: String = "distance",
        @Query("attributes") attributes: String? = null
    ): YelpSearchResponse

    /**
     * Fetch full details (hours, phone, attributes) for a single business.
     */
    @GET("businesses/{id}")
    suspend fun getBusinessDetails(
        @Header("Authorization") bearerToken: String,
        @retrofit2.http.Path("id") businessId: String
    ): YelpBusinessDto
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

@JsonClass(generateAdapter = true)
data class YelpSearchResponse(
    @field:Json(name = "businesses") val businesses: List<YelpBusinessDto> = emptyList(),
    @field:Json(name = "total") val total: Int = 0,
    @field:Json(name = "region") val region: YelpRegionDto? = null
)

@JsonClass(generateAdapter = true)
data class YelpBusinessDto(
    @field:Json(name = "id") val id: String,
    @field:Json(name = "name") val name: String,
    @field:Json(name = "alias") val alias: String = "",
    @field:Json(name = "image_url") val imageUrl: String? = null,
    @field:Json(name = "url") val yelpUrl: String = "",
    @field:Json(name = "phone") val phone: String = "",
    @field:Json(name = "display_phone") val displayPhone: String = "",
    @field:Json(name = "review_count") val reviewCount: Int = 0,
    @field:Json(name = "rating") val rating: Double = 0.0,
    @field:Json(name = "price") val priceLevel: String? = null,
    @field:Json(name = "distance") val distanceMeters: Double = 0.0,
    @field:Json(name = "is_closed") val isClosed: Boolean = false,
    @field:Json(name = "categories") val categories: List<YelpCategoryDto> = emptyList(),
    @field:Json(name = "location") val location: YelpLocationDto,
    @field:Json(name = "coordinates") val coordinates: YelpCoordinatesDto? = null
)

@JsonClass(generateAdapter = true)
data class YelpCategoryDto(
    @field:Json(name = "alias") val alias: String,
    @field:Json(name = "title") val title: String
)

@JsonClass(generateAdapter = true)
data class YelpLocationDto(
    @field:Json(name = "address1") val address1: String? = null,
    @field:Json(name = "city") val city: String = "",
    @field:Json(name = "state") val state: String = "",
    @field:Json(name = "country") val country: String = "",
    @field:Json(name = "display_address") val displayAddress: List<String> = emptyList()
)

@JsonClass(generateAdapter = true)
data class YelpCoordinatesDto(
    @field:Json(name = "latitude") val latitude: Double,
    @field:Json(name = "longitude") val longitude: Double
)

@JsonClass(generateAdapter = true)
data class YelpRegionDto(
    @field:Json(name = "center") val center: YelpCoordinatesDto
)

// ---------------------------------------------------------------------------
// Category grid config — maps each UI icon to Yelp API category alias
// Matches the 9-grid in the SOW exactly
// ---------------------------------------------------------------------------

enum class PlaceCategory(
    val label: String,
    val yelpAlias: String,
    val iconSlug: String,
    val emoji: String,
    val attributes: String? = null,
    val groupTag: String = "General"
) {
    // -----------------------------------------------------------------------
    // Safety & Health
    // -----------------------------------------------------------------------
    SAFETY("Safety", "policestations", "police_shield", "🛡", groupTag = "Safety & Health"),
    URGENT_CARE("Urgent Care", "hospitals,emergencyrooms", "medical_cross", "🏥", groupTag = "Safety & Health"),
    PHARMACIES("Pharmacy", "drugstores", "pharmacy", "💊", groupTag = "Safety & Health"),
    FITNESS("Fitness", "gyms,fitness", "dumbbell", "💪", groupTag = "Safety & Health"),

    // -----------------------------------------------------------------------
    // Travel & Lodging
    // -----------------------------------------------------------------------
    HOTELS("Hotels", "hotels", "hotel", "🏨", groupTag = "Travel & Lodging"),
    VACATION_RENTALS("Vacation Rentals", "vacation_rentals", "house", "🏠", groupTag = "Travel & Lodging"),
    AIRPORTS("Airport Services", "airports", "plane", "✈️", groupTag = "Travel & Lodging"),
    TOURS("Tours & Activities", "tours,activities,culturalcenter", "compass", "🧭", groupTag = "Travel & Lodging"),

    // -----------------------------------------------------------------------
    // Transportation
    // -----------------------------------------------------------------------
    TRANSPORT("Public Transit", "taxis,publictransport,subway", "bus", "🚌", groupTag = "Transportation"),
    CAR_RENTAL("Car Rental", "carrental", "car", "🚗", groupTag = "Transportation"),
    EV_CHARGING("EV Charging", "evchargingstations", "electric_car", "⚡", groupTag = "Transportation"),
    GAS_STATIONS("Gas & Fuel", "servicestations", "gas", "⛽", groupTag = "Transportation"),

    // -----------------------------------------------------------------------
    // Dining & Cafes
    // -----------------------------------------------------------------------
    RESTAURANTS("Restaurants", "restaurants", "fork_knife", "🍜", attributes = "hot_and_new", groupTag = "Dining"),
    CAFES("Cafes", "cafes,coffee", "coffee", "☕", groupTag = "Dining"),
    NIGHTLIFE("Bars & Nightlife", "bars,nightlife", "moon_stars", "🌙", groupTag = "Dining"),

    // -----------------------------------------------------------------------
    // Finance & Services
    // -----------------------------------------------------------------------
    BANKS_ATMS("Banks & ATMs", "banks,atms", "bank", "🏦", groupTag = "Finance & Services"),

    // -----------------------------------------------------------------------
    // Culture & Shopping
    // -----------------------------------------------------------------------
    ARTS("Arts & Culture", "artmuseums,museums", "art", "🎨", groupTag = "Culture & Shopping"),
    SHOPPING("Shopping", "shopping,malls", "shopping_bag", "🛍", groupTag = "Culture & Shopping"),
    PARKS("Parks & Nature", "parks,hiking", "tree", "🌳", groupTag = "Culture & Shopping"),
    ENTERTAINMENT("Entertainment", "movietheaters,amusementparks,escape_games", "star", "🎭", groupTag = "Culture & Shopping")
}
