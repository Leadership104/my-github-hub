package com.kipita.presentation.translate

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.togetherWith
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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRowDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import kotlinx.coroutines.launch

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

private data class TravelLanguage(
    val name: String,
    val nativeName: String,
    val flag: String,
    val googleCode: String          // BCP-47 code for Google Translate URL
)

private data class TravelPhrase(
    val english: String,
    val translation: String,        // in the selected language
    val category: PhraseCategory,
    val phonetic: String = ""       // pronunciation guide
)

private enum class PhraseCategory(val label: String, val emoji: String) {
    EMERGENCY("Emergency", "🚨"),
    TRANSPORT("Transport", "🚕"),
    HOUSING("Housing", "🏨"),
    LOGISTICS("Essentials", "📋")
}

// ---------------------------------------------------------------------------
// Language database — top 20 global languages
// ---------------------------------------------------------------------------

private val languages = listOf(
    TravelLanguage("Mandarin Chinese", "中文",     "🇨🇳", "zh"),
    TravelLanguage("Spanish",          "Español",  "🇪🇸", "es"),
    TravelLanguage("Hindi",            "हिन्दी",    "🇮🇳", "hi"),
    TravelLanguage("Arabic",           "العربية",  "🇸🇦", "ar"),
    TravelLanguage("Bengali",          "বাংলা",    "🇧🇩", "bn"),
    TravelLanguage("Portuguese",       "Português","🇧🇷", "pt"),
    TravelLanguage("Russian",          "Русский",  "🇷🇺", "ru"),
    TravelLanguage("Japanese",         "日本語",   "🇯🇵", "ja"),
    TravelLanguage("Vietnamese",       "Tiếng Việt","🇻🇳","vi"),
    TravelLanguage("Turkish",          "Türkçe",   "🇹🇷", "tr"),
    TravelLanguage("Persian",          "فارسی",    "🇮🇷", "fa"),
    TravelLanguage("French",           "Français", "🇫🇷", "fr"),
    TravelLanguage("German",           "Deutsch",  "🇩🇪", "de"),
    TravelLanguage("Thai",             "ภาษาไทย", "🇹🇭", "th"),
    TravelLanguage("Korean",           "한국어",   "🇰🇷", "ko"),
    TravelLanguage("Italian",          "Italiano", "🇮🇹", "it"),
    TravelLanguage("Indonesian",       "Bahasa",   "🇮🇩", "id"),
    TravelLanguage("Dutch",            "Nederlands","🇳🇱","nl"),
    TravelLanguage("Swahili",          "Kiswahili","🇰🇪", "sw"),
    TravelLanguage("Greek",            "Ελληνικά", "🇬🇷", "el")
)

// ---------------------------------------------------------------------------
// Phrase database — 50 phrases per language (key for offline travel)
// Phrases are stored as (English, Translation, Phonetic) per language code.
// ---------------------------------------------------------------------------

private typealias LangCode = String
private data class PhraseRow(val en: String, val tr: String, val ph: String, val cat: PhraseCategory)

/** Master phrase list — 50 entries covering all 4 categories */
private val masterPhrases: Map<LangCode, List<PhraseRow>> = mapOf(

    // ── Mandarin ────────────────────────────────────────────────────────────
    "zh" to listOf(
        PhraseRow("Help!",                   "救命！",        "Jiùmìng!",       PhraseCategory.EMERGENCY),
        PhraseRow("Call the police!",        "打警察！",      "Dǎ jǐngchá!",   PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor",         "我需要医生",    "Wǒ xūyào yīshēng", PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?",  "医院在哪里？",  "Yīyuàn zài nǎlǐ?", PhraseCategory.EMERGENCY),
        PhraseRow("Call an ambulance",       "叫救护车",      "Jiào jiùhùchē",  PhraseCategory.EMERGENCY),
        PhraseRow("Fire!",                   "着火了！",      "Zháohuǒ le!",    PhraseCategory.EMERGENCY),
        PhraseRow("I've been robbed",        "我被抢了",      "Wǒ bèi qiǎng le", PhraseCategory.EMERGENCY),
        PhraseRow("I am lost",               "我迷路了",      "Wǒ mílù le",     PhraseCategory.EMERGENCY),
        PhraseRow("Emergency!",              "紧急！",        "Jǐnjí!",         PhraseCategory.EMERGENCY),
        PhraseRow("I need help",             "我需要帮助",    "Wǒ xūyào bāngzhù", PhraseCategory.EMERGENCY),
        PhraseRow("Where is the train station?","地铁站在哪里？","Dìtiě zhàn zài nǎlǐ?", PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?",  "多少钱？",      "Duōshǎo qián?",  PhraseCategory.TRANSPORT),
        PhraseRow("I need a taxi",           "我需要出租车",  "Wǒ xūyào chūzūchē", PhraseCategory.TRANSPORT),
        PhraseRow("Where is the bus stop?",  "公交站在哪？",  "Gōngjiāo zhàn zài nǎ?", PhraseCategory.TRANSPORT),
        PhraseRow("Airport, please",         "去机场",        "Qù jīchǎng",     PhraseCategory.TRANSPORT),
        PhraseRow("How far is it?",          "有多远？",      "Yǒu duō yuǎn?",  PhraseCategory.TRANSPORT),
        PhraseRow("Stop here, please",       "请停这里",      "Qǐng tíng zhèlǐ", PhraseCategory.TRANSPORT),
        PhraseRow("Turn left / right",       "左转 / 右转",   "Zuǒ zhuǎn / Yòu zhuǎn", PhraseCategory.TRANSPORT),
        PhraseRow("Straight ahead",          "直走",          "Zhí zǒu",        PhraseCategory.TRANSPORT),
        PhraseRow("Can you take me to…?",    "你能带我去…？", "Nǐ néng dài wǒ qù…?", PhraseCategory.TRANSPORT),
        PhraseRow("One ticket please",       "一张票请",      "Yī zhāng piào qǐng", PhraseCategory.TRANSPORT),
        PhraseRow("Is there Wi-Fi?",         "有WiFi吗？",    "Yǒu WiFi ma?",   PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?",     "你有空房间吗？","Nǐ yǒu kōng fángjiān ma?", PhraseCategory.HOUSING),
        PhraseRow("How much per night?",     "每晚多少钱？",  "Měi wǎn duōshǎo qián?", PhraseCategory.HOUSING),
        PhraseRow("I have a reservation",    "我有预订",      "Wǒ yǒu yùdìng",  PhraseCategory.HOUSING),
        PhraseRow("Check-in / Check-out",    "入住 / 退房",   "Rùzhù / Tuìfáng", PhraseCategory.HOUSING),
        PhraseRow("Where is the bathroom?",  "洗手间在哪里？","Xǐshǒujiān zài nǎlǐ?", PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please",   "WiFi密码请",    "WiFi mìmǎ qǐng", PhraseCategory.HOUSING),
        PhraseRow("Clean towels please",     "干净毛巾请",    "Gānjìng máojīn qǐng", PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?",  "包括早餐吗？",  "Bāokuò zǎocān ma?", PhraseCategory.HOUSING),
        PhraseRow("Do you have a safe?",     "你有保险箱吗？","Nǐ yǒu bǎoxiǎnxiāng ma?", PhraseCategory.HOUSING),
        PhraseRow("My key doesn't work",     "我的钥匙不工作","Wǒ de yàoshi bù gōngzuò", PhraseCategory.HOUSING),
        PhraseRow("Hello",                   "你好",          "Nǐ hǎo",         PhraseCategory.LOGISTICS),
        PhraseRow("Goodbye",                 "再见",          "Zàijiàn",        PhraseCategory.LOGISTICS),
        PhraseRow("Thank you",               "谢谢",          "Xièxiè",         PhraseCategory.LOGISTICS),
        PhraseRow("You're welcome",          "不客气",        "Bù kèqì",        PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No",                "是 / 不是",     "Shì / Bù shì",   PhraseCategory.LOGISTICS),
        PhraseRow("Please / Excuse me",      "请 / 对不起",   "Qǐng / Duìbùqǐ", PhraseCategory.LOGISTICS),
        PhraseRow("I don't understand",      "我不明白",      "Wǒ bù míngbái",  PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?",   "你会说英语吗？","Nǐ huì shuō Yīngyǔ ma?", PhraseCategory.LOGISTICS),
        PhraseRow("How much?",               "多少？",        "Duōshǎo?",       PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?",       "ATM在哪里？",   "ATM zài nǎlǐ?",  PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian",          "我是素食者",    "Wǒ shì sùshí zhě", PhraseCategory.LOGISTICS),
        PhraseRow("Water please",            "水请",          "Shuǐ qǐng",      PhraseCategory.LOGISTICS),
        PhraseRow("The check please",        "买单",          "Mǎidān",         PhraseCategory.LOGISTICS),
        PhraseRow("Can you write it down?",  "你能写下来吗？","Nǐ néng xiě xiàlái ma?", PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy",       "我有过敏",      "Wǒ yǒu guòmǐn",  PhraseCategory.LOGISTICS),
        PhraseRow("Sorry",                   "对不起",        "Duìbùqǐ",        PhraseCategory.LOGISTICS),
        PhraseRow("Good morning",            "早上好",        "Zǎoshang hǎo",   PhraseCategory.LOGISTICS),
        PhraseRow("Good night",              "晚安",          "Wǎn'ān",         PhraseCategory.LOGISTICS)
    ),

    // ── Spanish ─────────────────────────────────────────────────────────────
    "es" to listOf(
        PhraseRow("Help!",                   "¡Ayuda!",            "Ah-YOO-dah",        PhraseCategory.EMERGENCY),
        PhraseRow("Call the police!",        "¡Llame a la policía!","LYAH-meh poh-LEE-see-ah", PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor",         "Necesito un médico", "Neh-seh-SEE-toh oon MEH-dee-koh", PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?",  "¿Dónde está el hospital?", "DON-deh es-TAH el os-pee-TAL?", PhraseCategory.EMERGENCY),
        PhraseRow("Call an ambulance",       "Llame una ambulancia","LYAH-meh oo-nah am-boo-LAN-see-ah", PhraseCategory.EMERGENCY),
        PhraseRow("Fire!",                   "¡Fuego!",            "FWEH-go",           PhraseCategory.EMERGENCY),
        PhraseRow("I've been robbed",        "Me han robado",      "Meh an roh-BAH-doh", PhraseCategory.EMERGENCY),
        PhraseRow("I am lost",               "Estoy perdido/a",    "Es-TOY per-DEE-doh", PhraseCategory.EMERGENCY),
        PhraseRow("Emergency!",              "¡Emergencia!",       "Eh-mer-HEN-see-ah", PhraseCategory.EMERGENCY),
        PhraseRow("I need help",             "Necesito ayuda",     "Neh-seh-SEE-toh ah-YOO-dah", PhraseCategory.EMERGENCY),
        PhraseRow("Where is the train station?","¿Dónde está la estación?","DON-deh es-TAH la es-tah-see-ON?", PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?",  "¿Cuánto cuesta?",    "KWAN-toh KWES-tah?", PhraseCategory.TRANSPORT),
        PhraseRow("I need a taxi",           "Necesito un taxi",   "Neh-seh-SEE-toh oon TAK-see", PhraseCategory.TRANSPORT),
        PhraseRow("Where is the bus stop?",  "¿Dónde está la parada?","DON-deh es-TAH la pah-RAH-dah?", PhraseCategory.TRANSPORT),
        PhraseRow("Airport, please",         "Al aeropuerto, por favor","Al ah-eh-ro-PWER-toh", PhraseCategory.TRANSPORT),
        PhraseRow("How far is it?",          "¿A qué distancia está?","Ah keh dis-TAN-see-ah es-TAH?", PhraseCategory.TRANSPORT),
        PhraseRow("Stop here, please",       "Para aquí, por favor","PAH-rah ah-KEE", PhraseCategory.TRANSPORT),
        PhraseRow("Turn left / right",       "Gire a la izquierda / derecha","HEE-reh", PhraseCategory.TRANSPORT),
        PhraseRow("Straight ahead",          "Siga recto",         "SEE-gah REK-toh",   PhraseCategory.TRANSPORT),
        PhraseRow("Can you take me to…?",    "¿Puede llevarme a…?","PWEH-deh lyeh-VAR-meh ah?", PhraseCategory.TRANSPORT),
        PhraseRow("One ticket please",       "Un billete, por favor","Oon bee-YEH-teh",  PhraseCategory.TRANSPORT),
        PhraseRow("Is there Wi-Fi?",         "¿Hay Wi-Fi?",        "Eye Wee-Fee?",      PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?",     "¿Tiene una habitación?","TEE-en-eh oo-nah ah-bee-tah-see-ON?", PhraseCategory.HOUSING),
        PhraseRow("How much per night?",     "¿Cuánto por noche?", "KWAN-toh por NOH-cheh?", PhraseCategory.HOUSING),
        PhraseRow("I have a reservation",    "Tengo una reserva",  "TEN-go oo-nah reh-SER-vah", PhraseCategory.HOUSING),
        PhraseRow("Check-in / Check-out",    "Registro / Salida",  "Reh-HIS-tro / Sah-LEE-dah", PhraseCategory.HOUSING),
        PhraseRow("Where is the bathroom?",  "¿Dónde está el baño?","DON-deh es-TAH el BAHN-yoh?", PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please",   "Contraseña de Wi-Fi","Con-trah-SEH-nyah",  PhraseCategory.HOUSING),
        PhraseRow("Clean towels please",     "Toallas limpias, por favor","Toh-AH-yahs LIM-pee-ahs", PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?",  "¿Incluye el desayuno?","In-KLOO-yeh el deh-sah-YOO-noh?", PhraseCategory.HOUSING),
        PhraseRow("Do you have a safe?",     "¿Tiene una caja fuerte?","TEE-en-eh oo-nah KAH-hah FWER-teh?", PhraseCategory.HOUSING),
        PhraseRow("My key doesn't work",     "Mi llave no funciona","Mee LYAH-veh no foon-see-OH-nah", PhraseCategory.HOUSING),
        PhraseRow("Hello",                   "Hola",               "OH-lah",            PhraseCategory.LOGISTICS),
        PhraseRow("Goodbye",                 "Adiós",              "Ah-dee-OS",         PhraseCategory.LOGISTICS),
        PhraseRow("Thank you",               "Gracias",            "GRAH-see-ahs",      PhraseCategory.LOGISTICS),
        PhraseRow("You're welcome",          "De nada",            "Deh NAH-dah",       PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No",                "Sí / No",            "See / Noh",         PhraseCategory.LOGISTICS),
        PhraseRow("Please / Excuse me",      "Por favor / Perdón", "Por fah-VOR / Per-DON", PhraseCategory.LOGISTICS),
        PhraseRow("I don't understand",      "No entiendo",        "Noh en-tee-EN-doh", PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?",   "¿Habla inglés?",     "AH-blah een-GLAYS?", PhraseCategory.LOGISTICS),
        PhraseRow("How much?",               "¿Cuánto?",           "KWAN-toh?",         PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?",       "¿Dónde hay un cajero?","DON-deh eye oon kah-HEH-ro?", PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian",          "Soy vegetariano/a",  "Soy veh-heh-tah-ree-AH-no", PhraseCategory.LOGISTICS),
        PhraseRow("Water please",            "Agua, por favor",    "AH-gwah",           PhraseCategory.LOGISTICS),
        PhraseRow("The check please",        "La cuenta, por favor","Lah KWEN-tah",     PhraseCategory.LOGISTICS),
        PhraseRow("Can you write it down?",  "¿Puede escribirlo?", "PWEH-deh es-kree-BEER-lo?", PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy",       "Tengo una alergia",  "TEN-go oo-nah ah-LER-hee-ah", PhraseCategory.LOGISTICS),
        PhraseRow("Sorry",                   "Lo siento",          "Loh see-EN-toh",    PhraseCategory.LOGISTICS),
        PhraseRow("Good morning",            "Buenos días",        "BWEH-nos DEE-ahs",  PhraseCategory.LOGISTICS),
        PhraseRow("Good night",              "Buenas noches",      "BWEH-nahs NOH-chehs", PhraseCategory.LOGISTICS)
    ),

    // ── French ──────────────────────────────────────────────────────────────
    "fr" to listOf(
        PhraseRow("Help!",                   "Au secours !",       "Oh seh-KOOR",       PhraseCategory.EMERGENCY),
        PhraseRow("Call the police!",        "Appelez la police !", "Ah-peh-LAY la po-LEES", PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor",         "J'ai besoin d'un médecin","Zhay buh-ZWAN dun meh-DAN", PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?",  "Où est l'hôpital ?", "Oo ay loh-pee-TAL?", PhraseCategory.EMERGENCY),
        PhraseRow("Call an ambulance",       "Appelez une ambulance","Ah-peh-LAY ewn am-boo-LAHNS", PhraseCategory.EMERGENCY),
        PhraseRow("Fire!",                   "Au feu !",           "Oh fuh",             PhraseCategory.EMERGENCY),
        PhraseRow("I've been robbed",        "J'ai été volé",      "Zhay eh-tay voh-LAY", PhraseCategory.EMERGENCY),
        PhraseRow("I am lost",               "Je suis perdu",      "Zhuh swee pehr-DU",  PhraseCategory.EMERGENCY),
        PhraseRow("Emergency!",              "Urgence !",          "Oor-ZHAHNS",         PhraseCategory.EMERGENCY),
        PhraseRow("I need help",             "J'ai besoin d'aide", "Zhay buh-ZWAN dehd", PhraseCategory.EMERGENCY),
        PhraseRow("Where is the train station?","Où est la gare ?","Oo ay la gar?",      PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?",  "Combien ça coûte ?", "Kom-BYAN sah koot?", PhraseCategory.TRANSPORT),
        PhraseRow("I need a taxi",           "J'ai besoin d'un taxi","Zhay buh-ZWAN dun tak-SEE", PhraseCategory.TRANSPORT),
        PhraseRow("Where is the bus stop?",  "Où est l'arrêt de bus ?","Oo ay lah-REH duh boos?", PhraseCategory.TRANSPORT),
        PhraseRow("Airport, please",         "À l'aéroport, s'il vous plaît","Ah lah-EH-ro-por", PhraseCategory.TRANSPORT),
        PhraseRow("How far is it?",          "C'est à quelle distance ?","Say tah kel dis-TAHNS?", PhraseCategory.TRANSPORT),
        PhraseRow("Stop here, please",       "Arrêtez ici, s'il vous plaît","Ah-reh-TAY ee-SEE", PhraseCategory.TRANSPORT),
        PhraseRow("Turn left / right",       "Tournez à gauche / droite","Toor-NAY ah gohsh / drwat", PhraseCategory.TRANSPORT),
        PhraseRow("Straight ahead",          "Tout droit",         "Too drwah",          PhraseCategory.TRANSPORT),
        PhraseRow("Can you take me to…?",    "Pouvez-vous m'emmener à…?","Poo-VAY voo mam-NAY ah?", PhraseCategory.TRANSPORT),
        PhraseRow("One ticket please",       "Un billet, s'il vous plaît","Un bee-YEH",  PhraseCategory.TRANSPORT),
        PhraseRow("Is there Wi-Fi?",         "Y a-t-il du Wi-Fi ?","Ee ah-teel doo Wee-Fee?", PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?",     "Avez-vous une chambre ?","Ah-VAY voo ewn SHAHM-bruh?", PhraseCategory.HOUSING),
        PhraseRow("How much per night?",     "Combien par nuit ?", "Kom-BYAN par nwee?", PhraseCategory.HOUSING),
        PhraseRow("I have a reservation",    "J'ai une réservation","Zhay ewn reh-zer-vah-SYON", PhraseCategory.HOUSING),
        PhraseRow("Check-in / Check-out",    "Enregistrement / Départ","Ahn-reh-zhis-treh-MAHN", PhraseCategory.HOUSING),
        PhraseRow("Where is the bathroom?",  "Où est la salle de bains ?","Oo ay la sal duh ban?", PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please",   "Le mot de passe Wi-Fi","Luh moh duh pahs",  PhraseCategory.HOUSING),
        PhraseRow("Clean towels please",     "Des serviettes propres","Day sehr-VYET prop", PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?",  "Le petit-déjeuner est inclus ?","Luh puh-tee day-zhuh-NAY ay tan-KLOO?", PhraseCategory.HOUSING),
        PhraseRow("Do you have a safe?",     "Avez-vous un coffre-fort ?","Ah-VAY voo un kofr-FOR?", PhraseCategory.HOUSING),
        PhraseRow("My key doesn't work",     "Ma clé ne fonctionne pas","Ma klay nuh fonk-syon pah", PhraseCategory.HOUSING),
        PhraseRow("Hello",                   "Bonjour",            "Bon-ZHOOR",          PhraseCategory.LOGISTICS),
        PhraseRow("Goodbye",                 "Au revoir",          "Oh ruh-VWAR",        PhraseCategory.LOGISTICS),
        PhraseRow("Thank you",               "Merci",              "Mehr-SEE",           PhraseCategory.LOGISTICS),
        PhraseRow("You're welcome",          "De rien",            "Duh RYAN",           PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No",                "Oui / Non",          "Wee / Nohn",         PhraseCategory.LOGISTICS),
        PhraseRow("Please / Excuse me",      "S'il vous plaît / Excusez-moi","Seel voo play", PhraseCategory.LOGISTICS),
        PhraseRow("I don't understand",      "Je ne comprends pas","Zhuh nuh kom-PRAHN pah", PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?",   "Parlez-vous anglais ?","Par-LAY voo an-GLAY?", PhraseCategory.LOGISTICS),
        PhraseRow("How much?",               "Combien ?",          "Kom-BYAN?",          PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?",       "Où est le distributeur ?","Oo ay luh dis-tree-boo-TUR?", PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian",          "Je suis végétarien(ne)","Zhuh swee veh-zheh-tah-RYAN", PhraseCategory.LOGISTICS),
        PhraseRow("Water please",            "De l'eau, s'il vous plaît","Duh loh",       PhraseCategory.LOGISTICS),
        PhraseRow("The check please",        "L'addition, s'il vous plaît","Lah-dee-SYON", PhraseCategory.LOGISTICS),
        PhraseRow("Can you write it down?",  "Pouvez-vous l'écrire ?","Poo-VAY voo leh-KREER?", PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy",       "J'ai une allergie",  "Zhay ewn ah-lehr-ZHEE", PhraseCategory.LOGISTICS),
        PhraseRow("Sorry",                   "Désolé",             "Day-zoh-LAY",        PhraseCategory.LOGISTICS),
        PhraseRow("Good morning",            "Bonjour",            "Bon-ZHOOR",          PhraseCategory.LOGISTICS),
        PhraseRow("Good night",              "Bonne nuit",         "Bon nwee",           PhraseCategory.LOGISTICS)
    ),

    // ── German ──────────────────────────────────────────────────────────────
    "de" to listOf(
        PhraseRow("Help!","Hilfe!","HIL-fuh",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police!","Rufen Sie die Polizei!","ROO-fen zee dee po-lee-TSAI",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Ich brauche einen Arzt","Ikh BROW-khuh EYE-nen artst",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Wo ist das Krankenhaus?","Voh ist das KRAN-ken-house?",PhraseCategory.EMERGENCY),
        PhraseRow("Call an ambulance","Rufen Sie einen Krankenwagen","ROO-fen zee EYE-nen KRAN-ken-vah-gen",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Feuer!","FOY-er",PhraseCategory.EMERGENCY),
        PhraseRow("I've been robbed","Ich wurde beraubt","Ikh VOOR-duh buh-ROWBT",PhraseCategory.EMERGENCY),
        PhraseRow("I am lost","Ich habe mich verlaufen","Ikh HA-buh mikh fer-LOW-fen",PhraseCategory.EMERGENCY),
        PhraseRow("Emergency!","Notfall!","NOHT-fal",PhraseCategory.EMERGENCY),
        PhraseRow("I need help","Ich brauche Hilfe","Ikh BROW-khuh HIL-fuh",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the train station?","Wo ist der Bahnhof?","Voh ist dehr BAHN-hohf?",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Wie viel kostet das?","Vee feel KOS-tet das?",PhraseCategory.TRANSPORT),
        PhraseRow("I need a taxi","Ich brauche ein Taxi","Ikh BROW-khuh ain TAK-see",PhraseCategory.TRANSPORT),
        PhraseRow("Where is the bus stop?","Wo ist die Bushaltestelle?","Voh ist dee BOOS-hal-teh-shtel-uh?",PhraseCategory.TRANSPORT),
        PhraseRow("Airport, please","Zum Flughafen, bitte","Tsoom FLOOK-hah-fen, BIT-tuh",PhraseCategory.TRANSPORT),
        PhraseRow("How far is it?","Wie weit ist es?","Vee vait ist es?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here, please","Halten Sie hier bitte","HAL-ten zee heer BIT-tuh",PhraseCategory.TRANSPORT),
        PhraseRow("Turn left / right","Links / rechts abbiegen","Links / REKHts AB-bee-gen",PhraseCategory.TRANSPORT),
        PhraseRow("Straight ahead","Geradeaus","Geh-RAH-duh-ows",PhraseCategory.TRANSPORT),
        PhraseRow("Can you take me to…?","Können Sie mich nach … bringen?","KUN-en zee mikh nakh … BRING-en?",PhraseCategory.TRANSPORT),
        PhraseRow("One ticket please","Eine Fahrkarte bitte","EYE-nuh FAR-kar-tuh BIT-tuh",PhraseCategory.TRANSPORT),
        PhraseRow("Is there Wi-Fi?","Gibt es WLAN?","Gibt es VAY-lan?",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Haben Sie ein Zimmer frei?","HA-ben zee ain TSIM-er frai?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Wie viel pro Nacht?","Vee feel proh nakht?",PhraseCategory.HOUSING),
        PhraseRow("I have a reservation","Ich habe eine Reservierung","Ikh HA-buh EYE-nuh reh-zer-VEER-oong",PhraseCategory.HOUSING),
        PhraseRow("Check-in / Check-out","Einchecken / Auschecken","AIN-chek-en / OWS-chek-en",PhraseCategory.HOUSING),
        PhraseRow("Where is the bathroom?","Wo ist das Badezimmer?","Voh ist das BAH-duh-tsim-er?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","WLAN-Passwort bitte","VAY-lan PAS-vort BIT-tuh",PhraseCategory.HOUSING),
        PhraseRow("Clean towels please","Saubere Handtücher bitte","ZOW-buh-ruh HANT-too-khuh",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","Ist das Frühstück inbegriffen?","Ist das FROO-shtook IN-beh-grif-en?",PhraseCategory.HOUSING),
        PhraseRow("Do you have a safe?","Haben Sie einen Safe?","HA-ben zee EYE-nen safe?",PhraseCategory.HOUSING),
        PhraseRow("My key doesn't work","Mein Schlüssel funktioniert nicht","Main SHLUS-el fonk-tsee-oh-NEERT nikht",PhraseCategory.HOUSING),
        PhraseRow("Hello","Hallo","HA-loh",PhraseCategory.LOGISTICS),
        PhraseRow("Goodbye","Auf Wiedersehen","Owf VEE-duh-zay-en",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Danke","DANG-kuh",PhraseCategory.LOGISTICS),
        PhraseRow("You're welcome","Bitte","BIT-tuh",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Ja / Nein","Yah / Nine",PhraseCategory.LOGISTICS),
        PhraseRow("Please / Excuse me","Bitte / Entschuldigung","BIT-tuh / Ent-SHOOL-dee-goong",PhraseCategory.LOGISTICS),
        PhraseRow("I don't understand","Ich verstehe nicht","Ikh fer-SHTAY-uh nikht",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Sprechen Sie Englisch?","SHPREKH-en zee ENG-lish?",PhraseCategory.LOGISTICS),
        PhraseRow("How much?","Wie viel?","Vee feel?",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Wo ist der Geldautomat?","Voh ist dehr GELT-ow-toh-maht?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Ich bin Vegetarier","Ikh bin veh-geh-TAR-ee-er",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Wasser bitte","VAS-er BIT-tuh",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","Die Rechnung bitte","Dee REKH-noong BIT-tuh",PhraseCategory.LOGISTICS),
        PhraseRow("Can you write it down?","Können Sie es aufschreiben?","KUN-en zee es OWF-shrai-ben?",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Ich habe eine Allergie","Ikh HA-buh EYE-nuh ah-lehr-GEE",PhraseCategory.LOGISTICS),
        PhraseRow("Sorry","Es tut mir leid","Es toot meer lait",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Guten Morgen","GOO-ten MOR-gen",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Gute Nacht","GOO-tuh nakht",PhraseCategory.LOGISTICS)
    ),

    // ── Japanese ────────────────────────────────────────────────────────────
    "ja" to listOf(
        PhraseRow("Help!","助けて！","Tasukete!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police!","警察を呼んでください！","Keisatsu wo yonde kudasai!",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","医者が必要です","Isha ga hitsuyou desu",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","病院はどこですか？","Byouin wa doko desu ka?",PhraseCategory.EMERGENCY),
        PhraseRow("Call an ambulance","救急車を呼んでください","Kyuukyuusha wo yonde kudasai",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","火事！","Kaji!",PhraseCategory.EMERGENCY),
        PhraseRow("I've been robbed","強盗に遭いました","Goutou ni aimashita",PhraseCategory.EMERGENCY),
        PhraseRow("I am lost","迷子になりました","Maigo ni narimashita",PhraseCategory.EMERGENCY),
        PhraseRow("Emergency!","緊急！","Kinkyuu!",PhraseCategory.EMERGENCY),
        PhraseRow("I need help","助けが必要です","Tasuke ga hitsuyou desu",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the train station?","電車の駅はどこですか？","Densha no eki wa doko desu ka?",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","いくらですか？","Ikura desu ka?",PhraseCategory.TRANSPORT),
        PhraseRow("I need a taxi","タクシーが必要です","Takushii ga hitsuyou desu",PhraseCategory.TRANSPORT),
        PhraseRow("Where is the bus stop?","バス停はどこですか？","Basutei wa doko desu ka?",PhraseCategory.TRANSPORT),
        PhraseRow("Airport, please","空港へお願いします","Kuukou e onegaishimasu",PhraseCategory.TRANSPORT),
        PhraseRow("How far is it?","どのくらい遠いですか？","Dono kurai tooi desu ka?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here, please","ここで止めてください","Koko de tomete kudasai",PhraseCategory.TRANSPORT),
        PhraseRow("Turn left / right","左 / 右に曲がる","Hidari / Migi ni magaru",PhraseCategory.TRANSPORT),
        PhraseRow("Straight ahead","まっすぐ","Massugu",PhraseCategory.TRANSPORT),
        PhraseRow("Can you take me to…?","…まで連れて行ってもらえますか？","... made tsurete itte moraemasu ka?",PhraseCategory.TRANSPORT),
        PhraseRow("One ticket please","切符を一枚ください","Kippu wo ichimai kudasai",PhraseCategory.TRANSPORT),
        PhraseRow("Is there Wi-Fi?","Wi-Fiはありますか？","Wi-Fi wa arimasu ka?",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","空き部屋はありますか？","Aki heya wa arimasu ka?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","一泊いくらですか？","Ippaku ikura desu ka?",PhraseCategory.HOUSING),
        PhraseRow("I have a reservation","予約があります","Yoyaku ga arimasu",PhraseCategory.HOUSING),
        PhraseRow("Check-in / Check-out","チェックイン / チェックアウト","Chekku in / Chekku auto",PhraseCategory.HOUSING),
        PhraseRow("Where is the bathroom?","お手洗いはどこですか？","Otearai wa doko desu ka?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Wi-Fiのパスワードをください","Wi-Fi no pasuwaado wo kudasai",PhraseCategory.HOUSING),
        PhraseRow("Clean towels please","きれいなタオルをください","Kireina taoru wo kudasai",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","朝食は含まれていますか？","Choushoku wa fukumarete imasu ka?",PhraseCategory.HOUSING),
        PhraseRow("Do you have a safe?","金庫はありますか？","Kinko wa arimasu ka?",PhraseCategory.HOUSING),
        PhraseRow("My key doesn't work","鍵が使えません","Kagi ga tsukaemasen",PhraseCategory.HOUSING),
        PhraseRow("Hello","こんにちは","Konnichiwa",PhraseCategory.LOGISTICS),
        PhraseRow("Goodbye","さようなら","Sayounara",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","ありがとうございます","Arigatou gozaimasu",PhraseCategory.LOGISTICS),
        PhraseRow("You're welcome","どういたしまして","Dou itashimashite",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","はい / いいえ","Hai / Iie",PhraseCategory.LOGISTICS),
        PhraseRow("Please / Excuse me","お願いします / すみません","Onegaishimasu / Sumimasen",PhraseCategory.LOGISTICS),
        PhraseRow("I don't understand","わかりません","Wakarimasen",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","英語を話せますか？","Eigo wo hanasemasu ka?",PhraseCategory.LOGISTICS),
        PhraseRow("How much?","いくら？","Ikura?",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","ATMはどこですか？","ATM wa doko desu ka?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","ベジタリアンです","Bejitarian desu",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","お水をください","Omizu wo kudasai",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","お会計をお願いします","Okaikei wo onegaishimasu",PhraseCategory.LOGISTICS),
        PhraseRow("Can you write it down?","書いてもらえますか？","Kaite moraemasu ka?",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","アレルギーがあります","Arerugii ga arimasu",PhraseCategory.LOGISTICS),
        PhraseRow("Sorry","ごめんなさい","Gomen nasai",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","おはようございます","Ohayou gozaimasu",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","おやすみなさい","Oyasumi nasai",PhraseCategory.LOGISTICS)
    )
)

/** Fallback for languages not yet in the database — prompts Google Translate */
private fun fallbackPhrases(lang: TravelLanguage): List<PhraseRow> = listOf(
    PhraseRow("Help!","(see Google mode)","",PhraseCategory.EMERGENCY),
    PhraseRow("Call the police!","(see Google mode)","",PhraseCategory.EMERGENCY),
    PhraseRow("I need a doctor","(see Google mode)","",PhraseCategory.EMERGENCY),
    PhraseRow("Hello","(see Google mode)","",PhraseCategory.LOGISTICS),
    PhraseRow("Thank you","(see Google mode)","",PhraseCategory.LOGISTICS),
    PhraseRow("Yes / No","(see Google mode)","",PhraseCategory.LOGISTICS),
    PhraseRow("Where is the ATM?","(see Google mode)","",PhraseCategory.LOGISTICS),
    PhraseRow("Do you speak English?","(see Google mode)","",PhraseCategory.LOGISTICS),
    PhraseRow("Where is the hospital?","(see Google mode)","",PhraseCategory.EMERGENCY),
    PhraseRow("Airport, please","(see Google mode)","",PhraseCategory.TRANSPORT),
    PhraseRow("Do you have a room?","(see Google mode)","",PhraseCategory.HOUSING),
    PhraseRow("Wi-Fi password please","(see Google mode)","",PhraseCategory.HOUSING)
)

// ---------------------------------------------------------------------------
// TranslateScreen
// ---------------------------------------------------------------------------

@Composable
fun TranslateScreen(
    paddingValues: PaddingValues = PaddingValues(),
    onBack: () -> Unit = {},
    onOpenWebView: (url: String, title: String) -> Unit = { _, _ -> }
) {
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()
    val snackbarHost = remember { SnackbarHostState() }

    // Toggle: 0 = Google, 1 = Manual
    var modeIndex    by remember { mutableIntStateOf(1) }    // default Manual so offline works
    var langIndex    by remember { mutableIntStateOf(0) }
    var catIndex     by remember { mutableIntStateOf(0) }
    var searchText   by remember { mutableStateOf("") }

    val isManual = modeIndex == 1
    val selectedLang = languages[langIndex]
    val selectedCat  = PhraseCategory.entries[catIndex]
    val allPhrases   = masterPhrases[selectedLang.googleCode] ?: fallbackPhrases(selectedLang)
    val visiblePhrases = allPhrases.filter { phrase ->
        phrase.cat == selectedCat &&
        (searchText.isBlank() || phrase.en.contains(searchText, ignoreCase = true) ||
         phrase.tr.contains(searchText, ignoreCase = true))
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFFF3F4F6))) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 100.dp)
        ) {
            // ── Header ───────────────────────────────────────────────────────
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.linearGradient(listOf(Color(0xFF1A1A2E), Color(0xFF16213E))))
                        .padding(horizontal = 20.dp, vertical = 24.dp)
                        .padding(paddingValues)
                ) {
                    Column {
                        Text("🌐 Translate", color = Color.White.copy(.7f),
                            style = MaterialTheme.typography.labelLarge)
                        Text("Global Communication Hub",
                            style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                            color = Color.White, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }

            // ── Mode Toggle (Google / Manual) ────────────────────────────────
            item {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color.White)
                        .border(1.dp, KipitaBorder, RoundedCornerShape(14.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(
                        "🌐 Google Translate" to false,
                        "📖 Manual (Offline)"  to true
                    ).forEachIndexed { i, (label, _) ->
                        val selected = modeIndex == i
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (selected) KipitaRed else Color.Transparent)
                                .clickable {
                                    modeIndex = i
                                    if (i == 0) {   // switched TO Google — warn if offline detection
                                        scope.launch {
                                            snackbarHost.showSnackbar(
                                                "Google Translate requires data. Tap 'Manual' if offline."
                                            )
                                        }
                                    }
                                }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                label,
                                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                                color = if (selected) Color.White else KipitaTextSecondary
                            )
                        }
                    }
                }
            }

            // ── GOOGLE MODE ──────────────────────────────────────────────────
            if (!isManual) {
                item {
                    AnimatedVisibility(visible = true, enter = fadeIn() + slideInVertically { 20 }) {
                        Column(
                            modifier = Modifier
                                .padding(horizontal = 20.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(Color.White)
                                .border(1.dp, KipitaBorder, RoundedCornerShape(16.dp))
                                .padding(20.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.Wifi, null, tint = KipitaRed, modifier = Modifier.size(18.dp))
                                Spacer(Modifier.width(8.dp))
                                Text("Live Translation — requires data",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = KipitaTextSecondary)
                            }
                            Text("Open Google Translate in-app for real-time text, voice, and camera translation across 100+ languages.",
                                style = MaterialTheme.typography.bodySmall,
                                color = KipitaTextTertiary)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(KipitaRed)
                                    .clickable {
                                        onOpenWebView(
                                            "https://translate.google.com",
                                            "Google Translate"
                                        )
                                    }
                                    .padding(vertical = 14.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text("🌐", fontSize = 16.sp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Open Google Translate",
                                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold),
                                        color = Color.White)
                                }
                            }
                            // Language-specific Google Translate links
                            Text("Quick links by language:",
                                style = MaterialTheme.typography.labelSmall,
                                color = KipitaTextTertiary)
                            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                itemsIndexed(languages.take(10)) { _, lang ->
                                    Surface(
                                        shape = RoundedCornerShape(20.dp),
                                        color = KipitaCardBg,
                                        modifier = Modifier
                                            .border(1.dp, KipitaBorder, RoundedCornerShape(20.dp))
                                            .clickable {
                                                onOpenWebView(
                                                    "https://translate.google.com/?sl=en&tl=${lang.googleCode}&op=translate",
                                                    "English → ${lang.name}"
                                                )
                                            }
                                    ) {
                                        Text(
                                            "${lang.flag} ${lang.nativeName}",
                                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                                            style = MaterialTheme.typography.labelSmall
                                        )
                                    }
                                }
                            }
                            // Offline fallback notice
                            Surface(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(10.dp),
                                color = Color(0xFFFFF3E0)
                            ) {
                                Row(modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Default.WifiOff, null,
                                        tint = Color(0xFFE65100), modifier = Modifier.size(16.dp))
                                    Spacer(Modifier.width(8.dp))
                                    Text("No signal? Switch to Manual mode for offline phrases.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFFE65100))
                                }
                            }
                        }
                    }
                }
            }

            // ── MANUAL MODE ──────────────────────────────────────────────────
            if (isManual) {

                // Language selector
                item {
                    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                        Text("Select Language",
                            style = MaterialTheme.typography.titleSmall.copy(fontWeight = FontWeight.SemiBold),
                            color = KipitaOnSurface,
                            modifier = Modifier.padding(bottom = 10.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            itemsIndexed(languages) { i, lang ->
                                val sel = i == langIndex
                                Column(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(14.dp))
                                        .background(if (sel) KipitaRed else Color.White)
                                        .border(1.dp, if (sel) KipitaRed else KipitaBorder, RoundedCornerShape(14.dp))
                                        .clickable { langIndex = i }
                                        .padding(horizontal = 14.dp, vertical = 10.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(lang.flag, fontSize = 22.sp)
                                    Spacer(Modifier.height(4.dp))
                                    Text(lang.nativeName,
                                        style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium),
                                        color = if (sel) Color.White else KipitaOnSurface)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }

                // Phrase count badge + offline indicator
                item {
                    Row(
                        modifier = Modifier.padding(horizontal = 20.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.WifiOff, null, tint = KipitaRed, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Offline mode · ${selectedLang.flag} ${selectedLang.name}",
                            style = MaterialTheme.typography.labelSmall,
                            color = KipitaRed)
                        Spacer(Modifier.weight(1f))
                        Surface(shape = RoundedCornerShape(20.dp), color = KipitaRedLight) {
                            Text("${allPhrases.size} phrases",
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold),
                                color = KipitaRed)
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }

                // Category tabs
                item {
                    PrimaryTabRow(
                        selectedTabIndex = catIndex,
                        modifier = Modifier.padding(horizontal = 20.dp).clip(RoundedCornerShape(12.dp)),
                        containerColor = Color.White,
                        contentColor = KipitaRed,
                        indicator = {
                            TabRowDefaults.PrimaryIndicator(
                                modifier = Modifier
                                    .tabIndicatorOffset(catIndex)
                                    .height(3.dp)
                                    .clip(RoundedCornerShape(topStart = 2.dp, topEnd = 2.dp)),
                                color = KipitaRed
                            )
                        },
                        divider = {}
                    ) {
                        PhraseCategory.entries.forEachIndexed { i, cat ->
                            Tab(
                                selected = catIndex == i,
                                onClick = { catIndex = i },
                                text = {
                                    Text("${cat.emoji} ${cat.label}",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            fontWeight = if (catIndex == i) FontWeight.SemiBold else FontWeight.Normal
                                        ),
                                        color = if (catIndex == i) KipitaRed else KipitaTextTertiary)
                                }
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }

                // Phrase cards
                itemsIndexed(visiblePhrases) { _, phrase ->
                    PhraseCard(phrase = phrase)
                }

                if (visiblePhrases.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("🔍", fontSize = 32.sp)
                                Spacer(Modifier.height(8.dp))
                                Text("No phrases found",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = KipitaTextSecondary)
                                Text("Switch to Google mode for this language",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = KipitaTextTertiary)
                            }
                        }
                    }
                }
            }
        }

        // Snackbar — offline fallback notification
        SnackbarHost(
            hostState = snackbarHost,
            modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 80.dp)
        )
    }
}

// ---------------------------------------------------------------------------
// PhraseCard — shows English phrase + translation + phonetic guide
// ---------------------------------------------------------------------------
@Composable
private fun PhraseCard(phrase: PhraseRow) {
    val catColor = when (phrase.cat) {
        PhraseCategory.EMERGENCY -> Color(0xFFFFEBEE)
        PhraseCategory.TRANSPORT -> Color(0xFFE3F2FD)
        PhraseCategory.HOUSING   -> Color(0xFFE8F5E9)
        PhraseCategory.LOGISTICS -> Color(0xFFFFF9C4)
    }
    val accentColor = when (phrase.cat) {
        PhraseCategory.EMERGENCY -> Color(0xFFE53935)
        PhraseCategory.TRANSPORT -> Color(0xFF1565C0)
        PhraseCategory.HOUSING   -> Color(0xFF2E7D32)
        PhraseCategory.LOGISTICS -> Color(0xFFF9A825)
    }

    Column(
        modifier = Modifier
            .padding(horizontal = 20.dp, vertical = 4.dp)
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .border(1.dp, KipitaBorder, RoundedCornerShape(14.dp))
    ) {
        // Category stripe
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(catColor)
                .padding(horizontal = 14.dp, vertical = 8.dp)
        ) {
            Text(
                phrase.en,
                style = MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold),
                color = KipitaOnSurface
            )
        }
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
            Text(
                phrase.tr,
                style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                color = accentColor
            )
            if (phrase.ph.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "🔊 ${phrase.ph}",
                    style = MaterialTheme.typography.bodySmall,
                    color = KipitaTextTertiary,
                    fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                )
            }
        }
    }
}
