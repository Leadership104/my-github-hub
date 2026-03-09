package com.kipita.presentation.advisory

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.kipita.BuildConfig
import com.kipita.domain.model.NoticeCategory
import com.kipita.domain.model.SeverityLevel
import com.kipita.domain.model.TravelNotice
import com.kipita.presentation.map.collectAsStateWithLifecycleCompat
import com.kipita.presentation.theme.KipitaBorder
import com.kipita.presentation.theme.KipitaCardBg
import com.kipita.presentation.theme.KipitaGreenAccent
import com.kipita.presentation.theme.KipitaOnSurface
import com.kipita.presentation.theme.KipitaRed
import com.kipita.presentation.theme.KipitaTextSecondary
import java.time.ZoneId
import java.time.format.DateTimeFormatter

// ---------------------------------------------------------------------------
// Sample nearby safety/health locations (visual reference for emulator)
// ---------------------------------------------------------------------------
private data class SampleLocation(
    val name: String,
    val subtitle: String,
    val address: String,
    val rating: Double,
    val reviewCount: Int,
    val distanceMi: Double,
    val isOpen: Boolean,
    val phone: String,
    val emoji: String
)

private val sampleSafetyLocations = listOf(
    SampleLocation(
        name = "Los Angeles Police Dept.",
        subtitle = "Police Station",
        address = "150 N Los Angeles St, Los Angeles, CA 90012",
        rating = 3.9,
        reviewCount = 142,
        distanceMi = 0.6,
        isOpen = true,
        phone = "+12134856811",
        emoji = "🛡️"
    ),
    SampleLocation(
        name = "LA County Fire Station 9",
        subtitle = "Fire & Emergency Services",
        address = "430 E College St, Los Angeles, CA 90012",
        rating = 4.5,
        reviewCount = 67,
        distanceMi = 0.9,
        isOpen = true,
        phone = "+12136128911",
        emoji = "🚒"
    ),
    SampleLocation(
        name = "Downtown Emergency Center",
        subtitle = "Emergency Management",
        address = "200 N Spring St, Los Angeles, CA 90012",
        rating = 4.1,
        reviewCount = 38,
        distanceMi = 1.2,
        isOpen = true,
        phone = "+12132621990",
        emoji = "🚨"
    )
)

private val sampleHealthLocations = listOf(
    SampleLocation(
        name = "Cedars-Sinai Medical Center",
        subtitle = "Hospital · Urgent Care",
        address = "8700 Beverly Blvd, Los Angeles, CA 90048",
        rating = 4.3,
        reviewCount = 892,
        distanceMi = 1.4,
        isOpen = true,
        phone = "+13104232000",
        emoji = "🏥"
    ),
    SampleLocation(
        name = "CVS Pharmacy",
        subtitle = "Pharmacy",
        address = "750 S Garfield Ave, Los Angeles, CA 90017",
        rating = 4.0,
        reviewCount = 215,
        distanceMi = 0.3,
        isOpen = true,
        phone = "+12132517700",
        emoji = "💊"
    ),
    SampleLocation(
        name = "Keck Hospital of USC",
        subtitle = "Hospital · Emergency Room",
        address = "1500 San Pablo St, Los Angeles, CA 90033",
        rating = 4.2,
        reviewCount = 478,
        distanceMi = 2.1,
        isOpen = true,
        phone = "+13234423814",
        emoji = "🏨"
    )
)

@Composable
fun AdvisoryScreen(
    paddingValues: PaddingValues,
    onBack: () -> Unit = {},
    viewModel: AdvisoryViewModel = hiltViewModel()
) {
    val state by viewModel.state.collectAsStateWithLifecycleCompat()
    val tabs = listOf(NoticeCategory.ADVISORY, NoticeCategory.SAFETY, NoticeCategory.HEALTH)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFAFAFA))
            .padding(paddingValues)
    ) {
        // Dark navy header — Places-style
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(listOf(Color(0xFF0D1B2A), Color(0xFF1B3A5C))))
                .padding(horizontal = 20.dp, vertical = 24.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Start,
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                Column {
                    Text(
                        "Travel Advisory",
                        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                        color = Color.White
                    )
                    Text(
                        "Safety · Health · Alerts",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.65f)
                    )
                }
            }
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            tabs.forEach { tab ->
                AdvisoryTabButton(
                    modifier = Modifier.weight(1f),
                    label = tab.name.lowercase().replaceFirstChar { it.uppercase() },
                    selected = tab == state.selectedTab,
                    onClick = { viewModel.selectTab(tab) }
                )
            }
        }
        if (state.loading) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(state.tabbedNotices) { notice ->
                    AdvisoryNoticeCard(notice = notice)
                }

                // ----------------------------------------------------------------
                // Sample nearby safety locations (Safety tab)
                // ----------------------------------------------------------------
                if (state.selectedTab == NoticeCategory.SAFETY) {
                    item {
                        Text(
                            "Nearby Safety Resources",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = KipitaOnSurface,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                        )
                        Text(
                            "Sample preview — live locations populate when active",
                            style = MaterialTheme.typography.labelSmall,
                            color = KipitaTextSecondary,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    items(sampleSafetyLocations) { loc ->
                        SampleNearbyCard(location = loc)
                    }
                }

                // ----------------------------------------------------------------
                // Sample nearby health locations (Health tab)
                // ----------------------------------------------------------------
                if (state.selectedTab == NoticeCategory.HEALTH) {
                    item {
                        Text(
                            "Nearby Health Resources",
                            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
                            color = KipitaOnSurface,
                            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp)
                        )
                        Text(
                            "Sample preview — live locations populate when active",
                            style = MaterialTheme.typography.labelSmall,
                            color = KipitaTextSecondary,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                    }
                    items(sampleHealthLocations) { loc ->
                        SampleNearbyCard(location = loc)
                    }
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Sample nearby resource card — same UI pattern as InlinePlaceCard
// ---------------------------------------------------------------------------
@Composable
private fun SampleNearbyCard(location: SampleLocation) {
    val context = LocalContext.current
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .border(1.dp, KipitaBorder, RoundedCornerShape(16.dp))
    ) {
        // Top info row
        Row(
            modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Circular emoji badge with pink/red ring
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .border(2.5.dp, Color(0xFFE91E63), CircleShape)
                    .padding(3.dp)
                    .clip(CircleShape)
                    .background(KipitaCardBg),
                contentAlignment = Alignment.Center
            ) {
                Text(location.emoji, fontSize = 28.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                // Name + Open badge
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        location.name,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.Bold),
                        color = KipitaOnSurface,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                    Text(
                        if (location.isOpen) "OPEN" else "CLOSED",
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold),
                        color = if (location.isOpen) KipitaGreenAccent else KipitaRed,
                        modifier = Modifier.padding(start = 6.dp)
                    )
                }
                // Subtitle
                Text(
                    location.subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextSecondary,
                    modifier = Modifier.padding(top = 2.dp)
                )
                // Rating + distance
                Row(
                    modifier = Modifier.padding(top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Star, contentDescription = null, tint = Color(0xFFFFC107), modifier = Modifier.size(13.dp))
                    Spacer(Modifier.width(2.dp))
                    Text(
                        "${"%.1f".format(location.rating)} (${location.reviewCount})",
                        style = MaterialTheme.typography.labelSmall,
                        color = KipitaTextSecondary
                    )
                    Spacer(Modifier.width(6.dp))
                    Text("$", style = MaterialTheme.typography.labelSmall, color = KipitaTextSecondary)
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "${"%.2f".format(location.distanceMi)}mi Away",
                        style = MaterialTheme.typography.labelSmall,
                        color = KipitaTextSecondary
                    )
                }
                // Address
                Text(
                    location.address,
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextSecondary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 3.dp)
                )
            }
        }

        // Divider
        Box(modifier = Modifier.fillMaxWidth().height(1.dp).background(KipitaBorder))

        // Action buttons
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            AdvisoryActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Call,
                label = "CALL",
                bgColor = Color(0xFF4CAF50),
                onClick = {
                    if (location.phone.isNotBlank()) {
                        runCatching {
                            context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${location.phone}")))
                        }
                    }
                }
            )
            AdvisoryActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.DirectionsWalk,
                label = "DIRECTIONS",
                bgColor = Color(0xFF2196F3),
                onClick = { /* navigate when live */ }
            )
            AdvisoryActionButton(
                modifier = Modifier.weight(1f),
                icon = Icons.Default.Info,
                label = "MORE INFO",
                bgColor = Color(0xFFFF5722),
                onClick = { /* more info when live */ }
            )
        }
    }
}

@Composable
private fun AdvisoryActionButton(
    modifier: Modifier = Modifier,
    icon: ImageVector,
    label: String,
    bgColor: Color,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .clickable(onClick = onClick)
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

@Composable
private fun AdvisoryTabButton(
    modifier: Modifier = Modifier,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .background(if (selected) Color(0xFF1A1A2E) else Color.White, RoundedCornerShape(14.dp))
            .border(1.dp, if (selected) Color(0xFF1A1A2E) else Color(0xFFE2E2E2), RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label,
            style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold),
            color = if (selected) Color.White else Color(0xFF1A1A1A)
        )
    }
}

@Composable
private fun AdvisoryNoticeCard(notice: TravelNotice) {
    val severityColor = when (notice.severity) {
        SeverityLevel.CRITICAL -> Color(0xFFC62828)
        SeverityLevel.HIGH -> Color(0xFFEF6C00)
        SeverityLevel.MEDIUM -> Color(0xFFF9A825)
        SeverityLevel.LOW -> Color(0xFF2E7D32)
    }
    val timeText = rememberNoticeTime(notice)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White, RoundedCornerShape(16.dp))
            .border(1.dp, Color(0xFFEAEAEA), RoundedCornerShape(16.dp))
            .padding(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        AsyncImage(
            model = staticMapImageUrl(notice),
            contentDescription = "${notice.title} location preview",
            modifier = Modifier
                .width(120.dp)
                .height(100.dp)
                .background(Color(0xFFF1F1F1), RoundedCornerShape(12.dp)),
            contentScale = ContentScale.Crop
        )
        Column(modifier = Modifier.weight(1f)) {
            Text(
                notice.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                notice.description,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF666666),
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 4.dp)
            )
            Row(
                modifier = Modifier.padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .background(severityColor.copy(alpha = 0.14f), CircleShape)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(notice.severity.name, color = severityColor, style = MaterialTheme.typography.labelSmall)
                }
                Text(
                    "Updated $timeText",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF666666)
                )
                if (notice.verified) {
                    Text("Verified", color = Color(0xFF2E7D32), fontSize = 11.sp)
                }
            }
            Row(
                modifier = Modifier.padding(top = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.LocationOn,
                    contentDescription = null,
                    tint = Color(0xFF757575)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    notice.sourceName,
                    style = MaterialTheme.typography.labelSmall,
                    color = Color(0xFF757575),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@Composable
private fun rememberNoticeTime(notice: TravelNotice): String {
    val formatter = DateTimeFormatter.ofPattern("MMM d, h:mm a")
    return notice.lastUpdated.atZone(ZoneId.systemDefault()).format(formatter)
}

private fun staticMapImageUrl(notice: TravelNotice): String {
    val lat = notice.location.latitude
    val lon = notice.location.longitude
    return "https://maps.googleapis.com/maps/api/staticmap?center=$lat,$lon&zoom=11&size=320x240&markers=color:red|$lat,$lon&key=${BuildConfig.GOOGLE_PLACES_API_KEY}"
}
