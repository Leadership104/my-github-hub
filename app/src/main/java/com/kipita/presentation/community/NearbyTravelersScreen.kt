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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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

private data class TravelerProfile(
    val id: String,
    val name: String,
    val city: String,
    val country: String,
    val flag: String,
    val travelStyle: String,
    val mutualGroups: Int,
    val username: String,
    val avatarColor: Color,
    val avatarLetter: String
)

private val sampleNearbyTravelers = listOf(
    TravelerProfile("1","Alex R.","New York","USA","🇺🇸","Digital Nomad",2,"@alexr",Color(0xFF1A237E),"A"),
    TravelerProfile("2","Maria S.","Barcelona","Spain","🇪🇸","Budget Traveler",1,"@marias",Color(0xFF880E4F),"M"),
    TravelerProfile("3","Kai T.","Tokyo","Japan","🇯🇵","Culture Explorer",3,"@kait",Color(0xFF1B5E20),"K"),
    TravelerProfile("4","Priya L.","Mumbai","India","🇮🇳","Food Traveler",1,"@priyal",Color(0xFF006064),"P"),
    TravelerProfile("5","Luca F.","Milan","Italy","🇮🇹","Adventure Seeker",0,"@lucaf",Color(0xFF37474F),"L"),
    TravelerProfile("6","Sofia N.","Athens","Greece","🇬🇷","Slow Traveler",2,"@sofian",Color(0xFF4A148C),"S"),
    TravelerProfile("7","Omar H.","Dubai","UAE","🇦🇪","Business Traveler",1,"@omarh",Color(0xFF01579B),"O"),
    TravelerProfile("8","Yuki M.","Osaka","Japan","🇯🇵","Foodie",3,"@yukim",Color(0xFF1A237E),"Y")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NearbyTravelersScreen(
    paddingValues: PaddingValues = PaddingValues(),
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    var visible by remember { mutableStateOf(false) }
    var selectedTraveler by remember { mutableStateOf<TravelerProfile?>(null) }
    var sentInvites by remember { mutableStateOf(setOf<String>()) }

    LaunchedEffect(Unit) { delay(80); visible = true }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Color(0xFFF3F4F6)),
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
                Row(verticalAlignment = Alignment.Top) {
                    IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                    Spacer(Modifier.width(4.dp))
                    Column {
                        Text("👥 Nearby Travelers", color = Color.White.copy(.7f),
                            style = MaterialTheme.typography.labelLarge)
                        Text("Connect with travelers in your area",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White, modifier = Modifier.padding(top = 2.dp))
                        Spacer(Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.LocationOn, null,
                                tint = KipitaRed, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Based on your current location",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(.60f))
                        }
                    }
                }
            }
        }

        // Info card
        item {
            AnimatedVisibility(visible = visible, enter = fadeIn() + slideInVertically { 20 }) {
                Surface(
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 12.dp).fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    color = KipitaRedLight
                ) {
                    Row(modifier = Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text("ℹ️", fontSize = 18.sp)
                        Spacer(Modifier.width(10.dp))
                        Text(
                            "Send an email invite to connect. Messaging is unlocked only after the other traveler accepts your invite.",
                            style = MaterialTheme.typography.bodySmall,
                            color = KipitaOnSurface
                        )
                    }
                }
            }
        }

        // Traveler cards
        itemsIndexed(sampleNearbyTravelers) { index, traveler ->
            AnimatedVisibility(
                visible = visible,
                enter = fadeIn() + slideInVertically { 40 + index * 20 }
            ) {
                TravelerCard(
                    traveler = traveler,
                    isSent = traveler.id in sentInvites,
                    onClick = { selectedTraveler = traveler },
                    onQuickInvite = {
                        sentInvites = sentInvites + traveler.id
                        runCatching {
                            val intent = Intent(Intent.ACTION_SENDTO).apply {
                                data = Uri.parse("mailto:")
                                putExtra(Intent.EXTRA_SUBJECT, "Join me on Kipita!")
                                putExtra(Intent.EXTRA_TEXT,
                                    "Hey ${traveler.name}! I'd like to connect with you on Kipita. " +
                                    "Accept this invite to start messaging: https://Kipita.com/invite/${traveler.username}")
                            }
                            context.startActivity(intent)
                        }
                    },
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 5.dp)
                )
            }
        }
    }

    // Traveler detail bottom sheet
    selectedTraveler?.let { traveler ->
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)
        ModalBottomSheet(
            onDismissRequest = { selectedTraveler = null },
            sheetState = sheetState,
            containerColor = Color.White,
            shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
        ) {
            TravelerDetailSheet(
                traveler = traveler,
                isSent = traveler.id in sentInvites,
                onSendInvite = { email ->
                    sentInvites = sentInvites + traveler.id
                    runCatching {
                        val intent = Intent(Intent.ACTION_SENDTO).apply {
                            data = Uri.parse("mailto:$email")
                            putExtra(Intent.EXTRA_SUBJECT, "Kipita Travel Invite from ${traveler.name}")
                            putExtra(Intent.EXTRA_TEXT,
                                "Hi! I'd like to connect with you on Kipita and share travel plans. " +
                                "Click here to accept and start messaging: https://Kipita.com/invite/${traveler.username}")
                        }
                        context.startActivity(intent)
                    }
                    selectedTraveler = null
                },
                onClose = { selectedTraveler = null }
            )
        }
    }
}

@Composable
private fun TravelerCard(
    traveler: TravelerProfile,
    isSent: Boolean,
    onClick: () -> Unit,
    onQuickInvite: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color.White)
            .clickable(onClick = onClick)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(traveler.avatarColor),
            contentAlignment = Alignment.Center
        ) {
            Text(traveler.avatarLetter,
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = Color.White)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(traveler.name,
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = KipitaOnSurface)
                Spacer(Modifier.width(6.dp))
                Text(traveler.flag, fontSize = 14.sp)
            }
            Text("${traveler.city}, ${traveler.country}",
                style = MaterialTheme.typography.bodySmall,
                color = KipitaTextSecondary)
            if (traveler.mutualGroups > 0) {
                Text("${traveler.mutualGroups} mutual groups",
                    style = MaterialTheme.typography.labelSmall,
                    color = KipitaRed)
            }
        }
        // Quick invite button
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(if (isSent) Color(0xFFE8F5E9) else KipitaRedLight)
                .clickable(enabled = !isSent, onClick = onQuickInvite)
                .padding(horizontal = 12.dp, vertical = 7.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    if (isSent) Icons.Default.Check else Icons.Default.PersonAdd,
                    null,
                    tint = if (isSent) Color(0xFF2E7D32) else KipitaRed,
                    modifier = Modifier.size(14.dp)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    if (isSent) "Sent" else "Invite",
                    style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = if (isSent) Color(0xFF2E7D32) else KipitaRed
                )
            }
        }
    }
}

@Composable
private fun TravelerDetailSheet(
    traveler: TravelerProfile,
    isSent: Boolean,
    onSendInvite: (email: String) -> Unit,
    onClose: () -> Unit
) {
    var emailInput by remember { mutableStateOf("") }
    var emailError by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically) {
            Text("Traveler Profile",
                style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
                color = KipitaOnSurface)
            Box(
                modifier = Modifier.size(32.dp).clip(CircleShape)
                    .background(KipitaCardBg).clickable(onClick = onClose),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Close, null, tint = KipitaTextTertiary, modifier = Modifier.size(16.dp))
            }
        }

        // Profile header
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier.size(64.dp).clip(CircleShape).background(traveler.avatarColor),
                contentAlignment = Alignment.Center
            ) {
                Text(traveler.avatarLetter,
                    style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                    color = Color.White)
            }
            Spacer(Modifier.width(14.dp))
            Column {
                Text("${traveler.name} ${traveler.flag}",
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.SemiBold))
                Text(traveler.username, style = MaterialTheme.typography.bodySmall, color = KipitaRed)
                Text("${traveler.city}, ${traveler.country}",
                    style = MaterialTheme.typography.bodySmall, color = KipitaTextSecondary)
                Surface(shape = RoundedCornerShape(20.dp), color = KipitaCardBg) {
                    Text(traveler.travelStyle,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall)
                }
            }
        }

        // Invite by email
        if (!isSent) {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Send Email Invite",
                    style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold))
                Text("Enter their email — messaging unlocks only after they accept.",
                    style = MaterialTheme.typography.bodySmall, color = KipitaTextSecondary)
                OutlinedTextField(
                    value = emailInput,
                    onValueChange = { emailInput = it; emailError = "" },
                    label = { Text("Their email address") },
                    leadingIcon = { Icon(Icons.Default.Email, null, tint = KipitaTextTertiary) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    isError = emailError.isNotBlank(),
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
                                emailInput.isBlank() -> emailError = "Please enter an email address"
                                !emailInput.contains("@") -> emailError = "Enter a valid email address"
                                else -> onSendInvite(emailInput.trim())
                            }
                        }
                        .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("Send Invite via Email",
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
                        color = Color.White)
                }
            }
        } else {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFE8F5E9)
            ) {
                Row(modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Check, null,
                        tint = Color(0xFF2E7D32), modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Invite sent! Messaging unlocks when they accept.",
                        style = MaterialTheme.typography.bodySmall, color = Color(0xFF2E7D32))
                }
            }
        }
        Spacer(Modifier.height(16.dp))
    }
}
