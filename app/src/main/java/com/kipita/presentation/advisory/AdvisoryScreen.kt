package com.kipita.presentation.advisory

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.kipita.domain.model.NoticeCategory
import com.kipita.presentation.map.collectAsStateWithLifecycleCompat

@Composable
fun AdvisoryScreen(
    paddingValues: PaddingValues,
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
        Text(
            "Advisory",
            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )
        TabRow(selectedTabIndex = tabs.indexOf(state.selectedTab).coerceAtLeast(0)) {
            tabs.forEachIndexed { idx, tab ->
                Tab(
                    selected = tabs[idx] == state.selectedTab,
                    onClick = { viewModel.selectTab(tab) },
                    text = { Text(tab.name.lowercase().replaceFirstChar { it.uppercase() }) }
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
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White, RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        Text(notice.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(
                            notice.description,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF666666),
                            modifier = Modifier.padding(top = 4.dp)
                        )
                    }
                }
            }
        }
    }
}

