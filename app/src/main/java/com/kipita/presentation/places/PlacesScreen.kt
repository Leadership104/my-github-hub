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
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.KeyboardActions
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
    val subCategories: List<PlaceSubCategory>,
    val gradientStart: Color,
    val gradientEnd: Color
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
    PlacesSection(
        label        = "Restaurants",
        emoji        = "🍽️",
        baseCategory = PlaceCategory.RESTAURANTS,
        subCategories = restaurantSubCategories,
        gradientStart = Color(0xFF1B5E20),
        gradientEnd   = Color(0xFF2E7D32)
    ),
    PlacesSection(
        label        = "Entertainment",
        emoji        = "🎭",
        baseCategory = PlaceCategory.ENTERTAINMENT,
        subCategories = entertainmentSubCategories,
        gradientStart = Color(0xFF1A237E),
        gradientEnd   = Color(0xFF283593)
    ),
    PlacesSection(
        label        = "Shopping",
        emoji        = "🛍️",
        baseCategory = PlaceCategory.SHOPPING,
        subCategories = shoppingSubCategories,
        gradientStart = Color(0xFF4A148C),
        gradientEnd   = Color(0xFF6A1B9A)
    )
)

// ---------------------------------------------------------------------------
// Popular quick-access subcategories (top 4 from each section → 3 rows of 4)
// ---------------------------------------------------------------------------
private val popularSubCategories: List<PlaceSubCategory> =
    restaurantSubCategories.take(4) +
    entertainmentSubCategories.take(4) +
    shoppingSubCategories.take(4)

// ---------------------------------------------------------------------------
// PlacesScreen — internal nav: browse grid ↔ category result screen
// ---------------------------------------------------------------------------

@Composable
fun PlacesScreen(
    paddingValues: PaddingValues,
    onBack: () -> Unit = {},
    viewModel: PlacesViewModel = hiltViewModel(),
    onCategorySelected: (PlaceCategory) -> Unit = {},
    onAskKipita: () -> Unit = {},
    onOpenWebView: (url: String, title: String) -> Unit = { _, _ -> },
    initialCategoryName: String? = null,
    onCategoryDeepLinkConsumed: () -> Unit = {}
) {
    // Store enum name so rememberSaveable can survive config change
    var selectedCategoryName by rememberSaveable { mutableStateOf<String?>(null) }
    val selectedCategory = selectedCategoryName?.let { name ->
        PlaceCategory.values().find { it.name == name }
    }

    // Consume deep-link once when initialCategoryName is set
    LaunchedEffect(initialCategoryName) {
        if (initialCategoryName != null) {
            selectedCategoryName = initialCategoryName
            onCategoryDeepLinkConsumed()
        }
    }

    if (selectedCategory != null) {
        // Click 1 complete → show results immediately
        PlacesCategoryResultScreen(
            category     = selectedCategory,
            onBack       = { selectedCategoryName = null },
            onOpenWebView = onOpenWebView,
            viewModel    = viewModel
        )
        return
    }

    BrowseGrid(
        paddingValues = paddingValues,
        onBack        = onBack,
        onAskKipita   = onAskKipita,
        viewModel     = viewModel,
        onNavigate    = { cat ->
            selectedCategoryName = cat.name
            onCategorySelected(cat)
        }
    )
}

// ---------------------------------------------------------------------------
// Browse grid screen
// ---------------------------------------------------------------------------

@Composable
private fun BrowseGrid(
    paddingValues: PaddingValues,
    onBack: () -> Unit,
    onAskKipita: () -> Unit,
    viewModel: PlacesViewModel,
    onNavigate: (PlaceCategory) -> Unit
) {
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()
    var visible by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var searchActive by remember { mutableStateOf(false) }

    // All subcategories flattened for search
    val allSubCats: List<PlaceSubCategory> = remember {
        placesSections.flatMap { it.subCategories }
    }
    val searchResults: List<PlaceSubCategory> = remember(searchQuery) {
        if (searchQuery.isBlank()) emptyList()
        else allSubCats.filter {
            it.label.contains(searchQuery, ignoreCase = true) ||
            it.baseCategory.label.contains(searchQuery, ignoreCase = true)
        }.distinctBy { it.label }
    }

    val gpsLauncher = rememberLauncherForActivityResult(RequestPermission()) { granted ->
        if (granted) {
            scope.launch(Dispatchers.IO) {
                val lm  = context.getSystemService(LocationManager::class.java)
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
                val lm  = context.getSystemService(LocationManager::class.java)
                val loc = lm?.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                    ?: lm?.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (loc != null) viewModel.updateLocation(loc.latitude, loc.longitude)
            } else {
                withContext(Dispatchers.Main) { gpsLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) }
            }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(paddingValues),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {

        // ----------------------------------------------------------------
        // Search bar — live filter across all subcategories
        // ----------------------------------------------------------------
        item {
            AnimatedVisibility(visible = visible, enter = fadeIn() + slideInVertically { -16 }) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp)
                        .shadow(4.dp, RoundedCornerShape(28.dp), spotColor = Color.Black.copy(alpha = 0.08f))
                        .clip(RoundedCornerShape(28.dp))
                        .background(Color.White)
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Search, contentDescription = null, tint = KipitaTextSecondary, modifier = Modifier.size(20.dp))
                    Spacer(Modifier.width(10.dp))
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it; searchActive = it.isNotBlank() },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        textStyle = MaterialTheme.typography.bodyMedium.copy(color = KipitaOnSurface),
                        cursorBrush = SolidColor(KipitaRed),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = {
                            searchResults.firstOrNull()?.let { onNavigate(it.baseCategory) }
                        }),
                        decorationBox = { inner ->
                            if (searchQuery.isBlank()) {
                                Text("Search restaurants, parks, hotels…", style = MaterialTheme.typography.bodyMedium, color = KipitaTextSecondary)
                            } else inner()
                        }
                    )
                    if (searchQuery.isNotBlank()) {
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "Clear",
                            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                            color = KipitaRed,
                            modifier = Modifier.clickable { searchQuery = ""; searchActive = false }
                        )
                    }
                }
            }
        }

        // ----------------------------------------------------------------
        // Search results (shown while typing, replaces grid)
        // ----------------------------------------------------------------
        if (searchActive && searchResults.isNotEmpty()) {
            item {
                Text(
                    "${searchResults.size} results",
                    style = MaterialTheme.typography.labelSmall,
                    color = KipitaTextSecondary,
                    modifier = Modifier.padding(horizontal = 20.dp, bottom = 4.dp)
                )
            }
            val searchRows = searchResults.chunked(4)
            items(searchRows) { row ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    row.forEach { subCat ->
                        SubCategoryTile(
                            modifier = Modifier.weight(1f),
                            subCat   = subCat,
                            onClick  = { onNavigate(subCat.baseCategory) }
                        )
                    }
                    repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
                }
            }
            item { Spacer(Modifier.height(16.dp)) }
        }

        // ----------------------------------------------------------------
        // Section label: Browse  (hidden while searching)
        // ----------------------------------------------------------------
        if (!searchActive) item {
            AnimatedVisibility(visible = visible, enter = fadeIn(tween(120))) {
                Text(
                    "Browse",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = KipitaOnSurface,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp)
                )
            }
        }

        // ----------------------------------------------------------------
        // Hero cards — one per main section (1 tap → results, hidden during search)
        // ----------------------------------------------------------------
        if (!searchActive) items(placesSections) { section ->
            AnimatedVisibility(visible = visible, enter = fadeIn(tween(160)) + slideInVertically(tween(160)) { 24 }) {
                SectionHeroCard(section = section, onClick = { onNavigate(section.baseCategory) })
            }
        }

        // ----------------------------------------------------------------
        // Section label: Quick Access  (hidden during search)
        // ----------------------------------------------------------------
        if (!searchActive) item {
            AnimatedVisibility(visible = visible, enter = fadeIn(tween(200))) {
                Text(
                    "Quick Access",
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = KipitaOnSurface,
                    modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 4.dp)
                )
            }
        }

        // ----------------------------------------------------------------
        // Popular subcategory grid — 4 columns, 3 rows (hidden during search)
        // ----------------------------------------------------------------
        val rows = popularSubCategories.chunked(4)
        if (!searchActive) items(rows) { row ->
            AnimatedVisibility(visible = visible, enter = fadeIn(tween(220)) + slideInVertically(tween(220)) { 16 }) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    row.forEach { subCat ->
                        SubCategoryTile(
                            modifier  = Modifier.weight(1f),
                            subCat    = subCat,
                            onClick   = { onNavigate(subCat.baseCategory) }
                        )
                    }
                    // Pad remaining slots so grid stays aligned
                    repeat(4 - row.size) {
                        Spacer(Modifier.weight(1f))
                    }
                }
            }
        }

        // ----------------------------------------------------------------
        // Ask Kipita CTA
        // ----------------------------------------------------------------
        item {
            AnimatedVisibility(visible = visible, enter = fadeIn(tween(250)) + slideInVertically(tween(250)) { 20 }) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 18.dp)
                        .shadow(
                            elevation    = 14.dp,
                            shape        = RoundedCornerShape(18.dp),
                            spotColor    = Color(0xFF1A1A2E).copy(alpha = 0.38f),
                            ambientColor = Color(0xFF1A1A2E).copy(alpha = 0.12f)
                        )
                        .clip(RoundedCornerShape(18.dp))
                        .background(Brush.linearGradient(listOf(Color(0xFF1A1A2E), Color(0xFF0D1B2A))))
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

// ---------------------------------------------------------------------------
// Section hero card — full-width, gradient bg, emoji + label + subcategory preview
// ---------------------------------------------------------------------------

@Composable
private fun SectionHeroCard(section: PlacesSection, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .shadow(6.dp, RoundedCornerShape(20.dp), spotColor = section.gradientStart.copy(alpha = 0.30f))
            .clip(RoundedCornerShape(20.dp))
            .background(Brush.linearGradient(listOf(section.gradientStart, section.gradientEnd)))
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 18.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    section.label,
                    style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                    color = Color.White
                )
                Spacer(Modifier.height(4.dp))
                // Preview: first 4 subcategory labels
                Text(
                    section.subCategories.take(4).joinToString(" · ") { it.emoji + " " + it.label },
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.75f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(Color.White.copy(alpha = 0.22f))
                        .padding(horizontal = 12.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.LocationOn, contentDescription = null, tint = Color.White, modifier = Modifier.size(12.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(
                        "Near you  →",
                        style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                        color = Color.White
                    )
                }
            }
            Spacer(Modifier.width(16.dp))
            Text(section.emoji, fontSize = 56.sp)
        }
    }
}

// ---------------------------------------------------------------------------
// Subcategory tile — compact 4-col grid tile
// ---------------------------------------------------------------------------

@Composable
private fun SubCategoryTile(
    modifier: Modifier = Modifier,
    subCat: PlaceSubCategory,
    onClick: () -> Unit
) {
    Column(
        modifier = modifier
            .shadow(2.dp, RoundedCornerShape(14.dp), ambientColor = Color.Black.copy(alpha = 0.04f))
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .border(1.dp, KipitaBorder, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(subCat.emoji, fontSize = 26.sp)
        Spacer(Modifier.height(4.dp))
        Text(
            subCat.label,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
            color = KipitaOnSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
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
                elevation    = 4.dp,
                shape        = RoundedCornerShape(16.dp),
                ambientColor = Color.Black.copy(alpha = 0.04f),
                spotColor    = Color.Black.copy(alpha = 0.08f)
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
                        model              = "https://places.googleapis.com/v1/${place.photoRef}/media?maxHeightPx=320&maxWidthPx=320&key=${BuildConfig.GOOGLE_PLACES_API_KEY}",
                        contentDescription = "${place.name} photo",
                        modifier           = Modifier.fillMaxSize(),
                        contentScale       = ContentScale.Crop
                    )
                } else {
                    Box(
                        modifier         = Modifier.fillMaxSize().background(KipitaCardBg),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(place.emoji, fontSize = 26.sp)
                    }
                }
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier                = Modifier.fillMaxWidth(),
                    horizontalArrangement   = Arrangement.SpaceBetween,
                    verticalAlignment       = Alignment.CenterVertically
                ) {
                    Text(
                        place.name,
                        style    = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color    = KipitaOnSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        if (place.isOpen) "OPEN" else "CLOSED",
                        style    = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color    = if (place.isOpen) KipitaGreenAccent else KipitaRed,
                        modifier = Modifier.padding(start = 6.dp)
                    )
                }
                Text(
                    place.category.label,
                    style    = MaterialTheme.typography.bodySmall,
                    color    = KipitaTextSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
                Row(
                    modifier          = Modifier.padding(top = 4.dp),
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
                Text(
                    place.address,
                    style    = MaterialTheme.typography.bodySmall,
                    color    = KipitaTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp)
                )
            }
        }

        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(KipitaBorder))

        Row(
            modifier              = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            PlaceActionButton(
                modifier = Modifier.weight(1f),
                icon     = Icons.Default.Call,
                label    = "CALL",
                bgColor  = Color(0xFF4CAF50),
                onClick  = {
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
                icon     = Icons.Default.DirectionsWalk,
                label    = "DIRECTIONS",
                bgColor  = Color(0xFF2196F3),
                onClick  = {
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
                icon     = Icons.Default.Info,
                label    = "MORE INFO",
                bgColor  = Color(0xFFFF5722),
                onClick  = {
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
        targetValue  = if (isPressed) 0.94f else 1f,
        animationSpec = spring(stiffness = Spring.StiffnessMedium),
        label        = "action-btn-press"
    )
    Row(
        modifier = modifier
            .scale(scale)
            .shadow(5.dp, RoundedCornerShape(20.dp), spotColor = bgColor.copy(alpha = 0.42f), ambientColor = bgColor.copy(alpha = 0.16f))
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(horizontal = 6.dp, vertical = 8.dp),
        verticalAlignment   = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(icon, contentDescription = label, tint = Color.White, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            style    = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
            color    = Color.White,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}
