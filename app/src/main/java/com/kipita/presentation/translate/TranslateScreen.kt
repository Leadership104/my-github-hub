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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
    ),
    "hi" to listOf(
        PhraseRow("Help!","मदद करो!","Madad karo!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","पुलिस को बुलाओ","Pulis ko bulao",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","मुझे डॉक्टर चाहिए","Mujhe doctor chahiye",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","अस्पताल कहाँ है?","Aspatal kahan hai?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","आग!","Aag!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","मैं खो गया हूँ","Main kho gaya hoon",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","मुझे हवाई अड्डे ले जाओ","Mujhe hawai adde le jao",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","इसकी कीमत क्या है?","Iski keemat kya hai?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","यहाँ रोकें","Yahan roken",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","क्या ... के लिए बस है?","Kya ... ke liye bus hai?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","रेलवे स्टेशन","Railway station",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","क्या आपके पास कमरा है?","Kya aapke paas kamra hai?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","प्रति रात कितना?","Prati raat kitna?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","चेकआउट समय?","Checkout samay?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","वाई-फाई पासवर्ड?","Wi-Fi password?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","क्या नाश्ता शामिल है?","Kya nashta shamil hai?",PhraseCategory.HOUSING),
        PhraseRow("Hello","नमस्ते","Namaste",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","धन्यवाद","Dhanyavaad",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","हाँ / नहीं","Haan / Nahin",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","एटीएम कहाँ है?","ATM kahan hai?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","क्या आप अंग्रेजी बोलते हैं?","Kya aap angrezi bolte hain?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","मैं शाकाहारी हूँ","Main shakahari hoon",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","पानी दीजिए","Paani dijiye",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","बिल लाइए","Bill laiye",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","मुझे एलर्जी है","Mujhe allergy hai",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","सुप्रभात","Suprabhat",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","शुभ रात्रि","Shubh ratri",PhraseCategory.LOGISTICS)
    ),
    "ar" to listOf(
        PhraseRow("Help!","مساعدة!","Musa-ada!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","اتصل بالشرطة","Ittasil bil-shurta",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","أحتاج طبيباً","Ahtaj tabiban",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","أين المستشفى؟","Ayn al-mustashfa?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","حريق!","Hariq!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","أنا ضائع","Ana da-i",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","خذني إلى المطار","Khudni ila al-matar",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","كم يكلف هذا؟","Kam yukallifu hadha?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","قف هنا من فضلك","Qif huna min fadlak",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","هل يوجد حافلة إلى...؟","Hal yujad hafila ila...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","محطة القطار","Mahattat al-qitar",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","هل لديك غرفة؟","Hal ladayk ghurfa?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","كم سعر الليلة؟","Kam si-r al-layla?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","وقت تسجيل الخروج؟","Waqt tasjil al-khuruj?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","كلمة مرور Wi-Fi؟","Kalimatu murur al-Wi-Fi?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","هل الإفطار مشمول؟","Hal al-iftar mashmul?",PhraseCategory.HOUSING),
        PhraseRow("Hello","مرحبا","Marhaban",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","شكراً","Shukran",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","نعم / لا","Na-am / La",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","أين الصراف الآلي؟","Ayn al-sarraf al-ali?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","هل تتكلم الإنجليزية؟","Hal tatakallam al-ingliziyya?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","أنا نباتي","Ana nabati",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","ماء من فضلك","Ma min fadlak",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","الحساب من فضلك","Al-hisab min fadlak",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","لدي حساسية","Ladayya hassasiyya",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","صباح الخير","Sabah al-khayr",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","تصبح على خير","Tusbih ala khayr",PhraseCategory.LOGISTICS)
    ),
    "pt" to listOf(
        PhraseRow("Help!","Socorro!","Socorro!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Ligue para a polícia","Ligue para a policia",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Preciso de um médico","Preciso de um medico",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Onde fica o hospital?","Onde fica o hospital?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Fogo!","Fogo!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Estou perdido","Estou perdido",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Leve-me ao aeroporto","Leve-me ao aeroporto",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Quanto custa?","Quanto custa?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Pare aqui, por favor","Pare aqui, por favor",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","Tem ônibus para...?","Tem onibus para...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Estação de trem","Estacao de trem",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Tem quarto disponível?","Tem quarto disponivel?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Quanto por noite?","Quanto por noite?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","Horário de saída?","Horario de saida?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Senha do Wi-Fi?","Senha do Wi-Fi?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","O café da manhã está incluído?","O cafe da manha esta incluido?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Olá","Ola",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Obrigado","Obrigado",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Sim / Não","Sim / Nao",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Onde fica o caixa eletrônico?","Onde fica o caixa eletronico?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Você fala inglês?","Voce fala ingles?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Sou vegetariano","Sou vegetariano",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Água, por favor","Agua, por favor",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","A conta, por favor","A conta, por favor",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Tenho alergia","Tenho alergia",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Bom dia","Bom dia",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Boa noite","Boa noite",PhraseCategory.LOGISTICS)
    ),
    "ru" to listOf(
        PhraseRow("Help!","Помогите!","Pomogite!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Вызовите полицию","Vyzovite politsiyu",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Мне нужен врач","Mne nuzhen vrach",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Где больница?","Gde bolnitsa?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Пожар!","Pozhar!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Я заблудился","Ya zabludilsya",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Отвезите меня в аэропорт","Otvezite menya v aeroport",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Сколько это стоит?","Skolko eto stoit?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Остановитесь здесь","Ostanovites zdyes",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","Есть автобус до...?","Yest avtobus do...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Железнодорожный вокзал","Zheleznodorozhny vokzal",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Есть ли свободный номер?","Yest li svobodny nomer?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Сколько за ночь?","Skolko za noch?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","Время выезда?","Vremya vyezda?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Пароль от Wi-Fi?","Parol ot Wi-Fi?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","Завтрак включён?","Zavtrak vklyuchen?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Привет","Privet",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Спасибо","Spasibo",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Да / Нет","Da / Net",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Где банкомат?","Gde bankomat?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Вы говорите по-английски?","Vy govorite po-angliyski?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Я вегетарианец","Ya vegetarianets",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Воду, пожалуйста","Vodu, pozhaluysta",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","Счёт, пожалуйста","Schet, pozhaluysta",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","У меня аллергия","U menya allergiya",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Доброе утро","Dobroye utro",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Спокойной ночи","Spokoinoi nochi",PhraseCategory.LOGISTICS)
    ),
    "th" to listOf(
        PhraseRow("Help!","ช่วยด้วย!","Chuay duay!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","โทรเรียกตำรวจ","Tho riak tamruat",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","ฉันต้องการหมอ","Chan tong kan mor",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","โรงพยาบาลอยู่ที่ไหน?","Rong phayaban yu thi nai?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","ไฟไหม้!","Fai mai!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","ฉันหลงทาง","Chan long thang",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","พาฉันไปสนามบิน","Pha chan pai sanam bin",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","ราคาเท่าไหร่?","Raka thao rai?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","หยุดที่นี่","Yut thi ni",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","มีรถเมล์ไป...?","Mi rot me pai...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","สถานีรถไฟ","Sathani rot fai",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","มีห้องว่างไหม?","Mi hong wang mai?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","ราคาต่อคืนเท่าไหร่?","Raka to khuen thao rai?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","เวลาเช็คเอาท์?","Wela check out?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","รหัสผ่าน Wi-Fi?","Rahat phan Wi-Fi?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","รวมอาหารเช้าไหม?","Ruam ahan chao mai?",PhraseCategory.HOUSING),
        PhraseRow("Hello","สวัสดี","Sawasdee",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","ขอบคุณ","Khob khun",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","ใช่ / ไม่","Chai / Mai",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","ตู้เอทีเอ็มอยู่ที่ไหน?","Tu ATM yu thi nai?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","คุณพูดภาษาอังกฤษได้ไหม?","Khun phut phasa Angkrit dai mai?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","ฉันกินเจ","Chan kin je",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","น้ำเปล่าหน่อย","Nam plao noi",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","เก็บเงินด้วย","Kep ngoen duay",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","ฉันแพ้อาหาร","Chan phae ahan",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","อรุณสวัสดิ์","Arun sawasdee",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","ราตรีสวัสดิ์","Ratri sawasdee",PhraseCategory.LOGISTICS)
    ),
    "ko" to listOf(
        PhraseRow("Help!","도와주세요!","Dowa juseyo!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","경찰을 불러주세요","Gyeongchal-eul bulleo juseyo",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","의사가 필요해요","Uisa-ga piryohaeyo",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","병원이 어디에 있어요?","Byeongwon-i eodi-e isseoyo?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","불이야!","Buri-ya!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","길을 잃었어요","Gil-eul ireosseoyo",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","공항으로 가주세요","Gonghang-euro gajuseyo",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","얼마예요?","Eolma-yeyo?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","여기서 세워주세요","Yeogi-seo seowo juseyo",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","...행 버스가 있나요?","...haeng beoseu-ga innayo?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","기차역","Gicha-yeok",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","빈 방 있어요?","Bin bang isseoyo?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","하룻밤에 얼마예요?","Harutbam-e eolma-yeyo?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","체크아웃 시간이 언제예요?","Chekeuaut sigan-i eonje-yeyo?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","와이파이 비밀번호 주세요","Waipai bimilbeonho juseyo",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","조식 포함인가요?","Josik poham-ingayo?",PhraseCategory.HOUSING),
        PhraseRow("Hello","안녕하세요","Annyeonghaseyo",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","감사합니다","Gamsahamnida",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","네 / 아니요","Ne / Aniyo",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","ATM이 어디에 있어요?","ATM-i eodi-e isseoyo?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","영어 할 줄 아세요?","Yeong-eo hal jul aseyo?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","저는 채식주의자예요","Jeoneun chaesikjuuija-yeyo",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","물 주세요","Mul juseyo",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","계산서 주세요","Gyesanseo juseyo",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","저는 알레르기가 있어요","Jeoneun allereugi-ga isseoyo",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","좋은 아침이에요","Joeun achim-i-eyo",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","안녕히 주무세요","Annyeonghi jumuseyo",PhraseCategory.LOGISTICS)
    ),
    "it" to listOf(
        PhraseRow("Help!","Aiuto!","Aiuto!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Chiama la polizia","Kiama la politsiya",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Ho bisogno di un medico","O bisonio di un mediko",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Dov'è l'ospedale?","Dove l-ospedale?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Fuoco!","Fwoko!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Mi sono perso","Mi sono perso",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Portami all'aeroporto","Portami all-aeroporto",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Quanto costa?","Kwanto kosta?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Si fermi qui per favore","Si fermi kwi per favore",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","C'è un autobus per...?","Che un autobus per...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Stazione ferroviaria","Stazione ferroviaria",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Ha una stanza disponibile?","A una stanza disponibile?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Quanto costa a notte?","Kwanto kosta a notte?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","A che ora si libera la stanza?","A ke ora si libera la stanza?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Password del Wi-Fi?","Password del Wi-Fi?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","La colazione è inclusa?","La kolazione e inclusa?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Ciao","Chao",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Grazie","Gratsie",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Sì / No","Si / No",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Dov'è il bancomat?","Dove il bankomat?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Parla inglese?","Parla inglese?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Sono vegetariano","Sono vegetariano",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Acqua per favore","Akwa per favore",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","Il conto per favore","Il konto per favore",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Ho un'allergia","O un allergia",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Buongiorno","Bwon-jorno",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Buonanotte","Bwona-notte",PhraseCategory.LOGISTICS)
    ),
    "bn" to listOf(
        PhraseRow("Help!","সাহায্য করুন!","Shahajyo korun!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","পুলিশকে ডাকুন","Pulish-ke dakun",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","আমার ডাক্তার প্রয়োজন","Amar daktar proyojon",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","হাসপাতাল কোথায়?","Haspataal kothay?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","আগুন!","Agun!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","আমি হারিয়ে গেছি","Ami hariye gechi",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","আমাকে বিমানবন্দরে নিয়ে যান","Amake bimanbondore niye jan",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","এটি কত খরচ হবে?","Eti kot khoroch hobe?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","এখানে থেমে যান","Ekhane theme jan",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","...যাওয়ার বাস আছে কি?","...jawar bas ache ki?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","ট্রেন স্টেশন","Train station",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","আপনার কাছে কক্ষ আছে কি?","Apnar kache kaksh ache ki?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","প্রতি রাত কত টাকা?","Prati rat kot taka?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","চেক আউট সময় কখন?","Check-out somoy kokhon?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","ওয়াইফাই পাসওয়ার্ড দিন","Wi-Fi password din",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","সকালের খাবার অন্তর্ভুক্ত আছে?","Sokaler khabar antorbhukto ache?",PhraseCategory.HOUSING),
        PhraseRow("Hello","হ্যালো","Hyalo",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","ধন্যবাদ","Dhonnobad",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","হ্যাঁ / না","Hya / Na",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","এটিএম কোথায়?","ATM kothay?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","আপনি ইংরেজি বলেন কি?","Apni ingreji bolen ki?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","আমি নিরামিষাশী","Ami niramishshashi",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","জল দিন","Jol din",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","বিল দিন","Bil din",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","আমার এলার্জি আছে","Amar elarji ache",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","শুভ সকাল","Shubho sokal",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","শুভ রাত্রি","Shubho ratri",PhraseCategory.LOGISTICS)
    ),
    "vi" to listOf(
        PhraseRow("Help!","Cứu tôi với!","Kuu toi voi!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Gọi cảnh sát","Goi canh sat",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Tôi cần một bác sĩ","Toi can mot bac si",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Bệnh viện ở đâu?","Benh vien o dau?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Cháy!","Chay!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Tôi bị lạc đường","Toi bi lac duong",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Đưa tôi đến sân bay","Dua toi den san bay",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Bao nhiêu tiền?","Bao nhieu tien?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Dừng lại đây","Dung lai day",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","Có xe buýt đến...?","Co xe buyt den...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Ga xe lửa","Ga xe lua",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Bạn có phòng không?","Ban co phong khong?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Bao nhiêu một đêm?","Bao nhieu mot dem?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","Giờ trả phòng?","Gio tra phong?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Mật khẩu Wi-Fi?","Mat khau Wi-Fi?",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","Bao gồm bữa sáng không?","Bao gom bua sang khong?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Xin chào","Xin chao",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Cảm ơn","Cam on",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Có / Không","Co / Khong",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Cây ATM ở đâu?","Cay ATM o dau?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Bạn có nói tiếng Anh không?","Ban co noi tieng Anh khong?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Tôi ăn chay","Toi an chay",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Nước vui lòng","Nuoc vui long",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","Tính tiền vui lòng","Tinh tien vui long",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Tôi bị dị ứng","Toi bi di ung",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Chào buổi sáng","Chao buoi sang",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Chúc ngủ ngon","Chuc ngu ngon",PhraseCategory.LOGISTICS)
    ),
    "tr" to listOf(
        PhraseRow("Help!","İmdat!","Imdat!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Polisi ara","Polisi ara",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Bir doktora ihtiyacım var","Bir doktora ihtiyacim var",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Hastane nerede?","Hastane nerede?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Yangın!","Yangin!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Kayboldum","Kayboldum",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Beni havaalanına götür","Beni havaalanina gotür",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Ne kadar tutuyor?","Ne kadar tutuyor?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Lütfen burada dur","Lutfen burada dur",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","...ya gidiş otobüsü var mı?","...ya gidis otobusu var mi?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Tren istasyonu","Tren istasyonu",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Odanız var mı?","Odaniz var mi?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Gece başına ne kadar?","Gece basina ne kadar?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","Çıkış saati ne zaman?","Cikis saati ne zaman?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Wi-Fi şifresi lütfen","Wi-Fi sifresi lutfen",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","Kahvaltı dahil mi?","Kahvalti dahil mi?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Merhaba","Merhaba",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Teşekkür ederim","Tesekkür ederim",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Evet / Hayır","Evet / Hayir",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","ATM nerede?","ATM nerede?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","İngilizce konuşuyor musunuz?","Ingilizce konusuyor musunuz?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Ben vejetaryenim","Ben vejetaryenim",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Lütfen su","Lutfen su",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","Lütfen hesap","Lutfen hesap",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Alerjim var","Alerjim var",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Günaydın","Gunaydin",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","İyi geceler","Iyi geceler",PhraseCategory.LOGISTICS)
    ),
    "id" to listOf(
        PhraseRow("Help!","Tolong!","Tolong!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Panggil polisi","Panggil polisi",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Saya butuh dokter","Saya butuh dokter",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Di mana rumah sakit?","Di mana rumah sakit?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Kebakaran!","Kebakaran!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Saya tersesat","Saya tersesat",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Bawa saya ke bandara","Bawa saya ke bandara",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Berapa harganya?","Berapa harganya?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Berhenti di sini tolong","Berhenti di sini tolong",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","Apakah ada bis ke...?","Apakah ada bis ke...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Stasiun kereta","Stasiun kereta",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Apakah Anda punya kamar?","Apakah Anda punya kamar?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Berapa per malam?","Berapa per malam?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","Jam check out berapa?","Jam check out berapa?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Sandi Wi-Fi tolong","Sandi Wi-Fi tolong",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","Apakah sarapan termasuk?","Apakah sarapan termasuk?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Halo","Halo",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Terima kasih","Terima kasih",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Ya / Tidak","Ya / Tidak",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Di mana ATM?","Di mana ATM?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Apakah Anda berbicara bahasa Inggris?","Apakah Anda berbicara bahasa Inggris?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Saya vegetarian","Saya vegetarian",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Air tolong","Air tolong",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","Rekening tolong","Rekening tolong",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Saya punya alergi","Saya punya alergi",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Selamat pagi","Selamat pagi",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Selamat malam","Selamat malam",PhraseCategory.LOGISTICS)
    ),
    "nl" to listOf(
        PhraseRow("Help!","Help!","Help!",PhraseCategory.EMERGENCY),
        PhraseRow("Call the police","Bel de politie","Bel de politie",PhraseCategory.EMERGENCY),
        PhraseRow("I need a doctor","Ik heb een dokter nodig","Ik heb een dokter nodig",PhraseCategory.EMERGENCY),
        PhraseRow("Where is the hospital?","Waar is het ziekenhuis?","Waar is het ziekenhuis?",PhraseCategory.EMERGENCY),
        PhraseRow("Fire!","Brand!","Brand!",PhraseCategory.EMERGENCY),
        PhraseRow("I'm lost","Ik ben verdwaald","Ik ben verdwaald",PhraseCategory.EMERGENCY),
        PhraseRow("Take me to the airport","Breng me naar het vliegveld","Breng me naar het vliegveld",PhraseCategory.TRANSPORT),
        PhraseRow("How much does it cost?","Hoeveel kost het?","Hoeveel kost het?",PhraseCategory.TRANSPORT),
        PhraseRow("Stop here please","Stop hier alstublieft","Stop hier alstublieft",PhraseCategory.TRANSPORT),
        PhraseRow("Is there a bus to...?","Is er een bus naar...?","Is er een bus naar...?",PhraseCategory.TRANSPORT),
        PhraseRow("Train station","Treinstation","Treinstation",PhraseCategory.TRANSPORT),
        PhraseRow("Do you have a room?","Heeft u een kamer?","Heeft u een kamer?",PhraseCategory.HOUSING),
        PhraseRow("How much per night?","Hoeveel per nacht?","Hoeveel per nacht?",PhraseCategory.HOUSING),
        PhraseRow("Check out time?","Hoe laat moet ik vertrekken?","Hoe laat moet ik vertrekken?",PhraseCategory.HOUSING),
        PhraseRow("Wi-Fi password please","Wachtwoord Wi-Fi alstublieft","Wachtwoord Wi-Fi alstublieft",PhraseCategory.HOUSING),
        PhraseRow("Is breakfast included?","Is ontbijt inbegrepen?","Is ontbijt inbegrepen?",PhraseCategory.HOUSING),
        PhraseRow("Hello","Hallo","Hallo",PhraseCategory.LOGISTICS),
        PhraseRow("Thank you","Dank je wel","Dank je wel",PhraseCategory.LOGISTICS),
        PhraseRow("Yes / No","Ja / Nee","Ja / Nee",PhraseCategory.LOGISTICS),
        PhraseRow("Where is the ATM?","Waar is de geldautomaat?","Waar is de geldautomaat?",PhraseCategory.LOGISTICS),
        PhraseRow("Do you speak English?","Spreekt u Engels?","Spreekt u Engels?",PhraseCategory.LOGISTICS),
        PhraseRow("I'm vegetarian","Ik ben vegetariër","Ik ben vegetarier",PhraseCategory.LOGISTICS),
        PhraseRow("Water please","Water alstublieft","Water alstublieft",PhraseCategory.LOGISTICS),
        PhraseRow("The check please","De rekening alstublieft","De rekening alstublieft",PhraseCategory.LOGISTICS),
        PhraseRow("I have an allergy","Ik ben allergisch","Ik ben allergisch",PhraseCategory.LOGISTICS),
        PhraseRow("Good morning","Goedemorgen","Goedemorgen",PhraseCategory.LOGISTICS),
        PhraseRow("Good night","Goedenacht","Goedenacht",PhraseCategory.LOGISTICS)
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

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                        }
                        Spacer(Modifier.width(4.dp))
                        Column {
                            Text("🌐 Translate", color = Color.White.copy(.7f),
                                style = MaterialTheme.typography.labelLarge)
                            Text("Global Communication Hub",
                                style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                                color = Color.White, modifier = Modifier.padding(top = 2.dp))
                        }
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
