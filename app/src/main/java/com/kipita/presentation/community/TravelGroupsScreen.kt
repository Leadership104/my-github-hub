package com.kipita.presentation.community

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.kipita.presentation.theme.KipitaBorder
import com.kipita.presentation.theme.KipitaCardBg
import com.kipita.presentation.theme.KipitaOnSurface
import com.kipita.presentation.theme.KipitaRed
import com.kipita.presentation.theme.KipitaRedLight
import com.kipita.presentation.theme.KipitaTextSecondary
import com.kipita.presentation.theme.KipitaTextTertiary
import kotlinx.coroutines.delay

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------
private enum class GroupCategory(val label: String, val emoji: String) {
    BUDGET("Budget Travel", "💰"),
    ADVENTURE("Adventure", "🏔️"),
    DIGITAL_NOMAD("Digital Nomad", "💻"),
    FOOD("Food & Culture", "🍜"),
    BACKPACKER("Backpacker", "🎒"),
    LUXURY("Luxury", "✨"),
    SOLO("Solo Travelers", "🧭"),
    FAMILY("Family Travel", "👨‍👩‍👧")
}

private data class TravelGroup(
    val id: String,
    val name: String,
    val description: String,
    val category: GroupCategory,
    val memberCount: Int,
    val maxMembers: Int,
    val adminName: String,
    val tags: List<String>,
    val avatarEmoji: String,
    val avatarColor: Color,
    val isPrivate: Boolean,
    val nextDestination: String
)

private val sampleGroups = listOf(
    TravelGroup("g1","Digital Nomads Europe 2026","Remote workers exploring EU cities, coworking spots, and Bitcoin merchants.",
        GroupCategory.DIGITAL_NOMAD,23,50,"Marco V.",listOf("Remote Work","Bitcoin","Co-working"),"💻",Color(0xFF1A237E),true,"Lisbon, Portugal"),
    TravelGroup("g2","Budget Backpackers SEA","Southeast Asia on <\$30/day. Tips, routes, hostels.",
        GroupCategory.BACKPACKER,41,100,"Priya L.",listOf("Budget","Hostels","SEA"),"🎒",Color(0xFF1B5E20),false,"Bangkok, Thailand"),
    TravelGroup("g3","Solo Female Travelers","Safety-first travel community for solo female adventurers.",
        GroupCategory.SOLO,18,40,"Sofia N.",listOf("Safety","Solo","Community"),"🧭",Color(0xFF880E4F),true,"Tokyo, Japan"),
    TravelGroup("g4","Foodie Passport","Culinary tourism — street food to Michelin stars.",
        GroupCategory.FOOD,12,30,"Yuki M.",listOf("Food","Culture","Cuisine"),"🍜",Color(0xFF006064),false,"Naples, Italy"),
    TravelGroup("g5","Summit Seekers","Hiking, trekking, and mountaineering worldwide.",
        GroupCategory.ADVENTURE,35,80,"Omar H.",listOf("Hiking","Mountains","Outdoor"),"🏔️",Color(0xFF37474F),false,"Patagonia, Argentina"),
    TravelGroup("g6","Luxury Nomads","5-star experiences and points hacking for premium travel.",
        GroupCategory.LUXURY,9,20,"Alex R.",listOf("Points","Luxury","First Class"),"✨",Color(0xFF4A148C),true,"Maldives"),
    TravelGroup("g7","Family Travel Tribe","Parents exploring the world with kids in tow.",
        GroupCategory.FAMILY,27,60,"Luca F.",listOf("Family","Kids","Safe Destinations"),"👨‍👩‍👧",Color(0xFF01579B),false,"Costa Rica"),
    TravelGroup("g8","Budget Euro Trip","First-time European travelers sharing rail passes, hostels and free activities.",
        GroupCategory.BUDGET,55,150,"Maria S.",listOf("Europe","Budget","Interrail"),"💰",Color(0xFF1A237E),false,"Prague, Czech Republic")
)

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TravelGroupsScreen(
    paddingValues: PaddingValues = PaddingValues(),
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    var visible by remember { mutableStateOf(false) }
    var selectedGroup by remember { mutableStateOf<TravelGroup?>(null) }
    var requestedGroups by remember { mutableStateOf(setOf<String>()) }
    var joinedGroups by remember { mutableStateOf(setOf<String>()) }
    var selectedCategory by remember { mutableStateOf<GroupCategory?>(null) }

    LaunchedEffect(Unit) { delay(80); visible = true }

    val filtered = if (selectedCategory == null) sampleGroups
    else sampleGroups.filter { it.category == selectedCategory }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF3F4F6)),
        contentPadding = PaddingValues(bottom = 100.dp)
    ) {
        // Header
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.linearGradient(listOf(Color(0xFF1A1A2E), Color(0xFF16213E))))
                    .padding(horizontal = 20.dp, vertical = 24.dp)
                    .padding(paddingValues)
            ) {
                Column {
                    Text("✈️ Travel Groups", color = Color.White.copy(.7f),
                        style = MaterialTheme.typography.labelLarge)
                    Text("Find your travel tribe",
                        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                        color = Color.White, modifier = Modifier.padding(top = 2.dp))
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Lock, null, tint = KipitaRed, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Join requests require admin approval",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(.60f))
                    }
                }
            }
        }

        // Category filter row
        item {
            AnimatedVisibility(visible = visible, enter = fadeIn() + slideInVertically { 16 }) {
                LazyRow(
                    modifier = Modifier.padding(vertical = 12.dp),
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        CategoryChip(
                            label = "All",
                            emoji = "🌍",
                            selected = selectedCategory == null,
                            onClick = { selectedCategory = null }
                        )
                    }
                    items(GroupCategory.entries.size) { i ->
                        val cat = GroupCategory.entries[i]
                        CategoryChip(
                            label = cat.label,
                            emoji = cat.emoji,
                            selected = selectedCategory == cat,
                            onClick = { selectedCategory = if (selectedCategory == cat) null else cat }
                        )
                    }
                }
            }
        }

        // Info card
        item {
            AnimatedVisibility(visible = visible, enter = fadeIn() + slideInVertically { 20 }) {
                Surface(
                    modifier = Modifier
                        .padding(horizontal = 20.dp, vertical = 4.dp)
                        .fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = KipitaRedLight
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text("ℹ️", fontSize = 18.sp)
                        Spacer(Modifier.width(10.dp))
                        Text(
                            "Request to join a group. The group admin will review and approve your request. Once accepted, you'll receive a confirmation email.",
                            style = MaterialTheme.typography.bodySmall,
                            color = KipitaOnSurface
                        )
                    }
                }
            }
        }

        // Groups count
        item {
            Text(
                "${filtered.size} groups found",
                style = MaterialTheme.typography.labelSmall,
                color = KipitaTextTertiary,
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)
            )
        }

        // Group cards
        itemsIndexed(filtered) { index, group ->
            AnimatedVisibility(
                visible = visible,
                enter = fadeIn() + slideInVertically { 40 + index * 20 }
            ) {
                TravelGroupCard(
                    group = group,
                    isRequested = group.id in requestedGroups,
                    isJoined = group.id in joinedGroups,
                    onClick = { selectedGroup = group },
                    onRequestJoin = {
                        if (group.id !in joinedGroups && group.id !in requestedGroups) {
                            requestedGroups = requestedGroups + group.id
                        }
                    },
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 5.dp)
                )
            }
        }
    }

    // Group detail bottom sheet
    selectedGroup?.let { group ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        ModalBottomSheet(
            onDismissRequest = { selectedGroup = null },
            sheetState = sheetState,
            containerColor = Color.White,
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        ) {
            GroupDetailSheet(
                group = group,
                isRequested = group.id in requestedGroups,
                isJoined = group.id in joinedGroups,
                onRequestJoin = { email ->
                    requestedGroups = requestedGroups + group.id
                    runCatching {
                        val intent = Intent(Intent.ACTION_SENDTO).apply {
                            data = Uri.parse("mailto:$email")
                            putExtra(Intent.EXTRA_SUBJECT, "Join Request: ${group.name} on Kipita")
                            putExtra(
                                Intent.EXTRA_TEXT,
                                "Hi ${group.adminName},\n\nI'd like to join the '${group.name}' group on Kipita.\n\n" +
                                "A bit about me: [Your intro here]\n\n" +
                                "Please accept my request so we can share travel plans!\n\nBest,\n[Your name]"
                            )
                        }
                        context.startActivity(intent)
                    }
                    selectedGroup = null
                },
                onClose = { selectedGroup = null }
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------
@Composable
private fun TravelGroupCard(
    group: TravelGroup,
    isRequested: Boolean,
    isJoined: Boolean,
    onClick: () -> Unit,
    onRequestJoin: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .clickable(onClick = onClick)
    ) {
        // Avatar stripe + info
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(group.avatarColor),
                contentAlignment = Alignment.Center
            ) {
                Text(group.avatarEmoji, fontSize = 22.sp)
            }
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        group.name,
                        style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                        color = KipitaOnSurface,
                        modifier = Modifier.weight(1f)
                    )
                    if (group.isPrivate) {
                        Icon(Icons.Default.Lock, null, tint = KipitaTextTertiary, modifier = Modifier.size(13.dp))
                    }
                }
                Text(
                    group.description,
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextSecondary,
                    maxLines = 2,
                    modifier = Modifier.padding(top = 2.dp)
                )
                Spacer(Modifier.height(6.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Groups, null, tint = KipitaTextTertiary, modifier = Modifier.size(12.dp))
                        Spacer(Modifier.width(3.dp))
                        Text(
                            "${group.memberCount}/${group.maxMembers}",
                            style = MaterialTheme.typography.labelSmall,
                            color = KipitaTextSecondary
                        )
                    }
                    Text("📍 ${group.nextDestination}",
                        style = MaterialTheme.typography.labelSmall,
                        color = KipitaTextSecondary)
                }
            }
        }

        // Tags + join button row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(KipitaCardBg)
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                group.tags.take(2).forEach { tag ->
                    Surface(shape = RoundedCornerShape(20.dp), color = Color.White) {
                        Text(
                            tag,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = KipitaTextSecondary
                        )
                    }
                }
            }
            // Join / Requested / Joined state button
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        when {
                            isJoined -> Color(0xFFE8F5E9)
                            isRequested -> KipitaCardBg
                            else -> KipitaRed
                        }
                    )
                    .clickable(enabled = !isRequested && !isJoined, onClick = onRequestJoin)
                    .padding(horizontal = 14.dp, vertical = 7.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        when {
                            isJoined -> Icons.Default.Check
                            isRequested -> Icons.AutoMirrored.Filled.Send
                            else -> Icons.Default.PersonAdd
                        },
                        null,
                        tint = when {
                            isJoined -> Color(0xFF2E7D32)
                            isRequested -> KipitaTextSecondary
                            else -> Color.White
                        },
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        when {
                            isJoined -> "Joined"
                            isRequested -> "Requested"
                            else -> "Request"
                        },
                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                        color = when {
                            isJoined -> Color(0xFF2E7D32)
                            isRequested -> KipitaTextSecondary
                            else -> Color.White
                        }
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Category chip
// ---------------------------------------------------------------------------
@Composable
private fun CategoryChip(label: String, emoji: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
        color = if (selected) KipitaRed else Color.White,
        shape = RoundedCornerShape(20.dp)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(emoji, fontSize = 13.sp)
            Spacer(Modifier.width(5.dp))
            Text(
                label,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal
                ),
                color = if (selected) Color.White else KipitaTextSecondary
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Group detail bottom sheet
// ---------------------------------------------------------------------------
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun GroupDetailSheet(
    group: TravelGroup,
    isRequested: Boolean,
    isJoined: Boolean,
    onRequestJoin: (adminEmail: String) -> Unit,
    onClose: () -> Unit
) {
    var emailInput by remember { mutableStateOf("") }
    var emailError by remember { mutableStateOf("") }
    var showEmailForm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Header row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                "Group Details",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = KipitaOnSurface
            )
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(KipitaCardBg)
                    .clickable(onClick = onClose),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Close, null, tint = KipitaTextTertiary, modifier = Modifier.size(16.dp))
            }
        }

        // Group header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(group.avatarColor),
                contentAlignment = Alignment.Center
            ) {
                Text(group.avatarEmoji, fontSize = 28.sp)
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        group.name,
                        style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold)
                    )
                    if (group.isPrivate) {
                        Spacer(Modifier.width(6.dp))
                        Surface(shape = RoundedCornerShape(6.dp), color = KipitaCardBg) {
                            Row(modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Lock, null, tint = KipitaTextTertiary, modifier = Modifier.size(10.dp))
                                Spacer(Modifier.width(3.dp))
                                Text("Private", style = MaterialTheme.typography.labelSmall, color = KipitaTextTertiary)
                            }
                        }
                    }
                }
                Text(group.category.emoji + " " + group.category.label,
                    style = MaterialTheme.typography.bodySmall, color = KipitaRed)
                Text("Admin: ${group.adminName}",
                    style = MaterialTheme.typography.bodySmall, color = KipitaTextSecondary)
            }
        }

        Text(group.description, style = MaterialTheme.typography.bodyMedium, color = KipitaOnSurface)

        // Stats row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(KipitaCardBg)
                .padding(14.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            StatItem("👥", "${group.memberCount}/${group.maxMembers}", "Members")
            StatItem("📍", group.nextDestination, "Next Stop")
            StatItem("🔒", if (group.isPrivate) "Invite Only" else "Open", "Access")
        }

        // Tags
        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            items(group.tags.size) { i ->
                Surface(shape = RoundedCornerShape(20.dp), color = KipitaCardBg) {
                    Text(
                        group.tags[i],
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = KipitaTextSecondary
                    )
                }
            }
        }

        // Group rules
        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            color = Color(0xFFFFF8E1)
        ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("📋 Group Rules",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = KipitaOnSurface)
                listOf(
                    "Be respectful and supportive of fellow travelers",
                    "Only share secure https:// links in group chats",
                    "No spam or self-promotion without admin approval",
                    "Invite links are for current members only — do not share publicly"
                ).forEach { rule ->
                    Text("• $rule",
                        style = MaterialTheme.typography.bodySmall,
                        color = KipitaTextSecondary)
                }
            }
        }

        // Join action
        when {
            isJoined -> {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFE8F5E9)
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Check, null, tint = Color(0xFF2E7D32), modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("You're a member! The admin will share the group chat link.",
                            style = MaterialTheme.typography.bodySmall, color = Color(0xFF2E7D32))
                    }
                }
            }
            isRequested -> {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = KipitaRedLight
                ) {
                    Row(modifier = Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.AutoMirrored.Filled.Send, null, tint = KipitaRed, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Join request sent! The admin will review and email you if approved.",
                            style = MaterialTheme.typography.bodySmall, color = KipitaRed)
                    }
                }
            }
            showEmailForm -> {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Enter your email to send a join request to ${group.adminName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = KipitaTextSecondary
                    )
                    OutlinedTextField(
                        value = emailInput,
                        onValueChange = { emailInput = it; emailError = "" },
                        label = { Text("Your email address") },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                        isError = emailError.isNotBlank(),
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = KipitaRed,
                            unfocusedBorderColor = KipitaBorder
                        )
                    )
                    if (emailError.isNotBlank()) {
                        Text(emailError, style = MaterialTheme.typography.labelSmall, color = KipitaRed)
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(KipitaRed)
                            .clickable {
                                when {
                                    emailInput.isBlank() -> emailError = "Please enter your email"
                                    !emailInput.contains("@") -> emailError = "Enter a valid email address"
                                    else -> onRequestJoin(emailInput.trim())
                                }
                            }
                            .padding(vertical = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            "Send Join Request",
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
                            color = Color.White
                        )
                    }
                }
            }
            else -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(KipitaRed)
                        .clickable { showEmailForm = true }
                        .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.PersonAdd, null, tint = Color.White, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "Request to Join",
                            style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
                            color = Color.White
                        )
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun StatItem(emoji: String, value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(emoji, fontSize = 18.sp)
        Text(value,
            style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
            color = KipitaOnSurface,
            maxLines = 1)
        Text(label, style = MaterialTheme.typography.labelSmall, color = KipitaTextSecondary)
    }
}
