package com.kipita.presentation.places

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.DirectionsWalk
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import android.Manifest
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts.RequestPermission
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.kipita.BuildConfig
import com.kipita.data.api.PlaceCategory
import com.kipita.data.repository.NearbyPlace
import com.kipita.presentation.map.collectAsStateWithLifecycleCompat
import com.kipita.presentation.theme.KipitaBorder
import com.kipita.presentation.theme.KipitaCardBg
import com.kipita.presentation.theme.KipitaGreenAccent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.kipita.presentation.theme.KipitaOnSurface
import com.kipita.presentation.theme.KipitaRed
import com.kipita.presentation.theme.KipitaTextSecondary
import kotlinx.coroutines.delay

// ---------------------------------------------------------------------------
// Sub-category data model
// ---------------------------------------------------------------------------

private data class PlaceSubCategory(
    val label: String,
    val emoji: String,
    val baseCategory: PlaceCategory
)

private data class PlacesSection(
    val label: String,
    val emoji: String,
    val baseCategory: PlaceCategory,
    val subCategories: List<PlaceSubCategory>
)

// ---------------------------------------------------------------------------
// Restaurant subcategories
// ---------------------------------------------------------------------------
private val restaurantSubCategories = listOf(
    PlaceSubCategory("American", "🇺🇸", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Bakery", "🥐", PlaceCategory.CAFES),
    PlaceSubCategory("Bar", "🍺", PlaceCategory.NIGHTLIFE),
    PlaceSubCategory("Barbecue", "🔥", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Brazilian", "🇧🇷", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Brunch", "🥞", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Fast Food", "🍔", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Breakfast", "🍳", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Chinese", "🥢", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("French", "🥐", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Greek", "🫒", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Hamburger", "🍔", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Indian", "🍛", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Indonesian", "🍜", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Italian", "🍝", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Japanese", "🍱", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Korean", "🥘", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Lebanese", "🧆", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Mediterranean", "🫙", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Mexican", "🌮", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Middle Eastern", "🧆", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Pizza", "🍕", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Ramen", "🍜", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Seafood", "🦞", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Spanish", "🥘", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Sushi", "🍣", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Thai", "🌶️", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Turkish", "🥙", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Vegan", "🥗", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Vegetarian", "🥬", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Vietnamese", "🍜", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Cafe", "☕", PlaceCategory.CAFES),
    PlaceSubCategory("Coffee Shop", "☕", PlaceCategory.CAFES),
    PlaceSubCategory("Ice Cream", "🍦", PlaceCategory.CAFES),
    PlaceSubCategory("Steak House", "🥩", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Cuban", "🇨🇺", PlaceCategory.RESTAURANTS),
    PlaceSubCategory("Caribbean", "🌴", PlaceCategory.RESTAURANTS)
)

// ---------------------------------------------------------------------------
// Entertainment subcategories
// ---------------------------------------------------------------------------
private val entertainmentSubCategories = listOf(
    PlaceSubCategory("Amusement Park", "🎢", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("Bowling Alley", "🎳", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("Amusement Center", "🎮", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("Aquarium", "🐠", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("Casino", "🎲", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("Community Center", "🏛️", PlaceCategory.ARTS),
    PlaceSubCategory("Cultural Center", "🎭", PlaceCategory.ARTS),
    PlaceSubCategory("Hiking Area", "🥾", PlaceCategory.PARKS),
    PlaceSubCategory("Historical", "🏛️", PlaceCategory.TOURS),
    PlaceSubCategory("Movie Theater", "🎬", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("National Park", "🌲", PlaceCategory.PARKS),
    PlaceSubCategory("Night Club", "🎵", PlaceCategory.NIGHTLIFE),
    PlaceSubCategory("Park", "🌳", PlaceCategory.PARKS),
    PlaceSubCategory("Tourist Attraction", "📸", PlaceCategory.TOURS),
    PlaceSubCategory("Visitor Center", "ℹ️", PlaceCategory.TOURS),
    PlaceSubCategory("Zoo", "🦁", PlaceCategory.ENTERTAINMENT),
    PlaceSubCategory("Golf Course", "⛳", PlaceCategory.ENTERTAINMENT)
)

// ---------------------------------------------------------------------------
// Shopping subcategories
// ---------------------------------------------------------------------------
private val shoppingSubCategories = listOf(
    PlaceSubCategory("Book Store", "📚", PlaceCategory.SHOPPING),
    PlaceSubCategory("Clothing Store", "👕", PlaceCategory.SHOPPING),
    PlaceSubCategory("Auto Parts", "🔧", PlaceCategory.SHOPPING),
    PlaceSubCategory("Discount Store", "🏷️", PlaceCategory.SHOPPING),
    PlaceSubCategory("Electronics", "📱", PlaceCategory.SHOPPING),
    PlaceSubCategory("Pet Shop", "🐾", PlaceCategory.SHOPPING),
    PlaceSubCategory("Jewelry", "💍", PlaceCategory.SHOPPING),
    PlaceSubCategory("Home Improvement", "🔨", PlaceCategory.SHOPPING)
)

private val placesSections = listOf(
    PlacesSection("Restaurants", "🍽️", PlaceCategory.RESTAURANTS, restaurantSubCategories),
    PlacesSection("Entertainment", "🎭", PlaceCategory.ENTERTAINMENT, entertainmentSubCategories),
    PlacesSection("Shopping", "🛍️", PlaceCategory.SHOPPING, shoppingSubCategories)
)

// ---------------------------------------------------------------------------
// Sample hardcoded place (visual reference — replaced by live results)
// ---------------------------------------------------------------------------
private val samplePlace = NearbyPlace(
    id = "sample_01",
    name = "The Golden Fork Restaurant",
    category = PlaceCategory.RESTAURANTS,
    emoji = "🍽️",
    address = "1842 Sunset Blvd, Los Angeles, CA 90026",
    distanceKm = 0.4,
    rating = 4.7,
    reviewCount = 312,
    isOpen = true,
    latitude = 34.0901,
    longitude = -118.3603,
    phone = "+12135550123",
    website = "https://example.com",
    photoRef = ""
)

@Composable
fun PlacesScreen(
    paddingValues: PaddingValues,
    onBack: () -> Unit = {},
    viewModel: PlacesViewModel = hiltViewModel(),
    onCategorySelected: (PlaceCategory) -> Unit = {},
    onAskKipita: () -> Unit = {},
    onOpenWebView: (url: String, title: String) -> Unit = { _, _ -> }
) {
    val state by viewModel.state.collectAsStateWithLifecycleCompat()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var visible by remember { mutableStateOf(false) }
    var resultsExpanded by rememberSaveable { mutableStateOf(true) }

    // Track which section is expanded (accordion style) and which subcat is selected
    var expandedSectionIndex by rememberSaveable { mutableIntStateOf(-1) }
    var selectedSubCatLabel by rememberSaveable { mutableStateOf("") }

    val gpsLauncher = rememberLauncherForActivityResult(RequestPermission()) { granted ->
        if (granted) {
            scope.launch(Dispatchers.IO) {
                val lm = context.getSystemService(LocationManager::class.java)
                val loc = lm?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?: lm?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (loc != null) viewModel.updateLocation(loc.latitude, loc.longitude)
            }
        }
    }

    LaunchedEffect(Unit) {
        delay(80); visible = true
        withContext(Dispatchers.IO) {
            val perm = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            if (perm == PackageManager.PERMISSION_GRANTED) {
                val lm = context.getSystemService(LocationManager::class.java)
                val loc = lm?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?: lm?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (loc != null) viewModel.updateLocation(loc.latitude, loc.longitude)
            } else {
                withContext(Dispatchers.Main) { gpsLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {

            // ----------------------------------------------------------------
            // Header
            // ----------------------------------------------------------------
            item {
                AnimatedVisibility(visible = visible, enter = fadeIn() + slideInVertically { -20 }) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF0D1B2A), Color(0xFF1B3A5C))
                                )
                            )
                            .padding(horizontal = 20.dp, vertical = 24.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Start,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            IconButton(onClick = onBack) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                                    contentDescription = "Back",
                                    tint = Color.White
                                )
                            }
                            Column {
                                Text(
                                    "Explore Places",
                                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                                    color = Color.White
                                )
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.padding(top = 3.dp)
                                ) {
                                    Icon(
                                        Icons.Default.LocationOn,
                                        contentDescription = null,
                                        tint = Color.White.copy(alpha = 0.65f),
                                        modifier = Modifier.size(12.dp)
                                    )
                                    Spacer(Modifier.width(3.dp))
                                    Text(
                                        "Restaurants · Entertainment · Shopping",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color.White.copy(alpha = 0.65f)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ----------------------------------------------------------------
            // Sample Preview Card (visual reference)
            // ----------------------------------------------------------------
            item {
                AnimatedVisibility(visible = visible, enter = fadeIn(tween(120)) + slideInVertically(tween(120)) { 16 }) {
                    Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "Sample Preview",
                                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = KipitaOnSurface
                            )
                            Text(
                                "Live results populate when active",
                                style = MaterialTheme.typography.labelSmall,
                                color = KipitaTextSecondary
                            )
                        }
                        InlinePlaceCard(place = samplePlace)
                    }
                }
            }

            // ----------------------------------------------------------------
            // Accordion sections: Restaurants, Entertainment, Shopping
            // ----------------------------------------------------------------
            item {
                AnimatedVisibility(visible = visible, enter = fadeIn(tween(150)) + slideInVertically(tween(150)) { 20 }) {
                    Column(
                        modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        placesSections.forEachIndexed { sectionIdx, section ->
                            PlacesSectionAccordion(
                                section = section,
                                isExpanded = expandedSectionIndex == sectionIdx,
                                selectedSubCatLabel = selectedSubCatLabel,
                                onHeaderClick = {
                                    expandedSectionIndex = if (expandedSectionIndex == sectionIdx) -1 else sectionIdx
                                },
                                onSubCategoryClick = { subCat ->
                                    selectedSubCatLabel = subCat.label
                                    viewModel.selectCategory(subCat.baseCategory)
                                    onCategorySelected(subCat.baseCategory)
                                    resultsExpanded = true
                                }
                            )
                        }
                    }
                }
            }

            // ----------------------------------------------------------------
            // Results section
            // ----------------------------------------------------------------
            if (resultsExpanded && selectedSubCatLabel.isNotBlank()) {
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.dp, KipitaBorder, RoundedCornerShape(16.dp))
                            .clickable { resultsExpanded = false }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            "Nearby $selectedSubCatLabel (${state.filteredPlaces.size})",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = KipitaOnSurface,
                            modifier = Modifier.weight(1f)
                        )
                        Icon(Icons.Default.ExpandLess, contentDescription = "Close results", tint = KipitaOnSurface)
                    }
                }
                if (state.isLoading) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 28.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = KipitaRed)
                        }
                    }
                } else if (state.error != null) {
                    item {
                        Text(
                            state.error ?: "Could not load places",
                            color = KipitaRed,
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
                        )
                    }
                } else {
                    items(state.filteredPlaces) { place ->
                        InlinePlaceCard(place = place)
                    }
                }
            }

            // ----------------------------------------------------------------
            // Ask Kipita CTA
            // ----------------------------------------------------------------
            item {
                AnimatedVisibility(visible = visible, enter = fadeIn(tween(200)) + slideInVertically(tween(200)) { 20 }) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 12.dp)
                            .shadow(
                                elevation = 14.dp,
                                shape = RoundedCornerShape(18.dp),
                                spotColor = Color(0xFF1A1A2E).copy(alpha = 0.38f),
                                ambientColor = Color(0xFF1A1A2E).copy(alpha = 0.12f)
                            )
                            .clip(RoundedCornerShape(18.dp))
                            .background(
                                brush = Brush.linearGradient(
                                    listOf(Color(0xFF1A1A2E), Color(0xFF0D1B2A))
                                )
                            )
                            .clickable(onClick = onAskKipita)
                            .padding(horizontal = 20.dp, vertical = 18.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("✨", fontSize = 24.sp)
                            Spacer(Modifier.width(10.dp))
                            Text(
                                "Ask Kipita",
                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White
                            )
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

// ---------------------------------------------------------------------------
// Accordion section composable
// ---------------------------------------------------------------------------
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PlacesSectionAccordion(
    section: PlacesSection,
    isExpanded: Boolean,
    selectedSubCatLabel: String,
    onHeaderClick: () -> Unit,
    onSubCategoryClick: (PlaceSubCategory) -> Unit
) {
    val accordionElevation by animateDpAsState(
        targetValue = if (isExpanded) 10.dp else 2.dp,
        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
        label = "accordion-shadow"
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .shadow(
                elevation = accordionElevation,
                shape = RoundedCornerShape(18.dp),
                spotColor = if (isExpanded) Color(0xFF1A1A2E).copy(alpha = 0.16f) else Color.Black.copy(alpha = 0.06f),
                ambientColor = Color.Black.copy(alpha = 0.04f)
            )
            .clip(RoundedCornerShape(18.dp))
            .background(Color.White)
            .border(1.dp, if (isExpanded) Color(0xFF1A1A2E) else KipitaBorder, RoundedCornerShape(18.dp))
    ) {
        // Section header (tap to expand/collapse)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onHeaderClick)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(13.dp))
                    .background(if (isExpanded) Color(0xFF1A1A2E) else KipitaCardBg),
                contentAlignment = Alignment.Center
            ) {
                Text(section.emoji, fontSize = 24.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = section.label,
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                    color = KipitaOnSurface
                )
                Text(
                    text = "${section.subCategories.size} categories",
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
            }
            Icon(
                imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                contentDescription = if (isExpanded) "Collapse" else "Expand",
                tint = KipitaOnSurface,
                modifier = Modifier.size(22.dp)
            )
        }

        // Subcategory chip grid (visible when expanded)
        AnimatedVisibility(visible = isExpanded) {
            FlowRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFF8F9FA))
                    .padding(horizontal = 12.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                section.subCategories.forEach { subCat ->
                    val isSelected = selectedSubCatLabel == subCat.label
                    Row(
                        modifier = Modifier
                            .then(
                                if (isSelected) Modifier.shadow(
                                    elevation = 4.dp,
                                    shape = RoundedCornerShape(20.dp),
                                    spotColor = Color(0xFF1A1A2E).copy(alpha = 0.22f),
                                    ambientColor = Color(0xFF1A1A2E).copy(alpha = 0.07f)
                                ) else Modifier
                            )
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) Color(0xFF1A1A2E) else Color.White)
                            .border(
                                width = 1.dp,
                                color = if (isSelected) Color(0xFF1A1A2E) else KipitaBorder,
                                shape = RoundedCornerShape(20.dp)
                            )
                            .clickable { onSubCategoryClick(subCat) }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(subCat.emoji, fontSize = 14.sp)
                        Spacer(Modifier.width(5.dp))
                        Text(
                            text = subCat.label,
                            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.Medium),
                            color = if (isSelected) Color.White else KipitaOnSurface,
                            maxLines = 1
                        )
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Place card — matches the provided UI design
// ---------------------------------------------------------------------------
@Composable
internal fun InlinePlaceCard(place: NearbyPlace) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
            .shadow(
                elevation = 4.dp,
                shape = RoundedCornerShape(16.dp),
                ambientColor = Color.Black.copy(alpha = 0.04f),
                spotColor = Color.Black.copy(alpha = 0.08f)
            )
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, KipitaBorder, RoundedCornerShape(16.dp))
    ) {
        // Top info row
        Row(
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Circular image with pink/red ring
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .border(2.5.dp, Color(0xFFE91E63), CircleShape)
                    .padding(3.dp)
                    .clip(CircleShape)
            ) {
                if (place.photoRef.isNotBlank()) {
                    AsyncImage(
                        model = "https://places.googleapis.com/v1/${place.photoRef}/media?maxHeightPx=320&maxWidthPx=320&key=${BuildConfig.GOOGLE_PLACES_API_KEY}",
                        contentDescription = "${place.name} photo",
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(KipitaCardBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(place.emoji, fontSize = 26.sp)
                    }
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                // Name + Open/Closed badge
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        place.name,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = KipitaOnSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        if (place.isOpen) "OPEN" else "CLOSED",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = if (place.isOpen) KipitaGreenAccent else KipitaRed,
                        modifier = Modifier.padding(start = 6.dp)
                    )
                }
                // Category
                Text(
                    place.category.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
                // Rating + price + distance
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (place.rating > 0) {
                        Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFC107), modifier = Modifier.size(13.dp))
                        Spacer(Modifier.width(2.dp))
                        Text(
                            "${"%.1f".format(place.rating)} (${place.reviewCount})",
                            style = MaterialTheme.typography.labelSmall,
                            color = KipitaTextSecondary
                        )
                        Spacer(Modifier.width(6.dp))
                        Text("$", style = MaterialTheme.typography.labelSmall, color = KipitaTextSecondary)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text(
                        "${"%.2f".format(place.distanceKm * 0.621371)}mi Away",
                        style = MaterialTheme.typography.labelSmall,
                        color = KipitaTextSecondary
                    )
                }
                // Address
                Text(
                    place.address,
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp)
                )
            }
        }

        // Divider
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(KipitaBorder)
        )

        // Action buttons row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            PlaceActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Call,
                label = "CALL",
                bgColor = Color(0xFF4CAF50),
                onClick = {
                    if (place.phone.isNotBlank()) {
                        runCatching {
                            val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${place.phone}"))
                            context.startActivity(intent)
                        }
                    }
                }
            )
            PlaceActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.DirectionsWalk,
                label = "DIRECTIONS",
                bgColor = Color(0xFF2196F3),
                onClick = {
                    val lat = place.latitude ?: return@PlaceActionButton
                    val lon = place.longitude ?: return@PlaceActionButton
                    runCatching {
                        val uri = Uri.parse("geo:$lat,$lon?q=$lat,$lon(${Uri.encode(place.name)})")
                        context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    }
                }
            )
            PlaceActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Info,
                label = "MORE INFO",
                bgColor = Color(0xFFFF5722),
                onClick = {
                    if (place.website.isNotBlank()) {
                        runCatching {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(place.website))
                            context.startActivity(intent)
                        }
                    }
                }
            )
        }
    }
}

@Composable
private fun PlaceActionButton(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    label: String,
    bgColor: Color,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.94f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label = "action-btn-press"
    )
    Row(
        modifier = modifier
            .scale(scale)
            .shadow(
                elevation = 5.dp,
                shape = RoundedCornerShape(20.dp),
                spotColor = bgColor.copy(alpha = 0.42f),
                ambientColor = bgColor.copy(alpha = 0.16f)
            )
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick
            )
            .padding(horizontal = 6.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
            color = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
