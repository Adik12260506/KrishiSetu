/**
 * KrishiSetu (कृषि-सेतु) Enterprise Web Application Controller
 * FS-2604: Offline-First Parametric Micro-Insurance
 */

// Immediate OAuth redirect popup check & auto-close
(function checkOAuthPopup() {
  try {
    const hash = window.location.hash;
    if (hash && (hash.includes('access_token=') || hash.includes('id_token=') || hash.includes('iss='))) {
      const cleanHash = hash.startsWith('#') ? hash.substring(1) : hash;
      const params = new URLSearchParams(cleanHash);
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');
      
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_TOKEN',
          id_token: idToken,
          access_token: accessToken
        }, '*');
        window.close();
      }
    }
  } catch (e) {}
})();

// State Variables
let currentView = 'landing'; // 'landing' | 'auth' | 'farmer' | 'admin'
let currentFarmerScreen = 'home';
let currentLang = 'hi';
let currentUser = null;
let currentFarmerId = 'farmer_user';
let isSimulatedOffline = false;
let clientWallet = new ClientWalletStorage(currentFarmerId);
let activeProduct = null;
let currentReconstructionTrail = null;

// Multi-lingual Prompts and Cues
const I18N = {
  hi: {
    user_label: 'किसान उपयोक्ता',
    voice_cue: 'बोलकर पूछें / योजना सुनें',
    voice_sub: 'अपनी भाषा में फसल सुरक्षा नियम सुनने के लिए टैप करें',
    tile_policy: 'मेरी सुरक्षा',
    tile_wallet: 'मेरा बटुआ',
    tile_payout: 'मेरा भुगतान',
    tile_sync: 'वायर सिंक',
    hero_title: 'मेरी फसल सुरक्षा',
    safe_phone: 'इस डिवाइस पर सुरक्षित',
    quiz_question: 'यदि 14 दिनों में वर्षा 20 मिमी होती है (35 मिमी सीमा से कम), तो क्या आपको स्वतः बीमा मिलेगा?',
    quiz_pass: 'बधाई हो! आपकी समझ की पुष्टि हो गई है। आपकी सुरक्षा सक्रिय है।',
    quiz_retry: 'आइए दोबारा सुनें। सूखा नियम समझने के लिए पुनः प्रयास करें।',
    spend_success: 'ऑफ़लाइन भुगतान सफल! नया शेष:',
    why_paid_title: 'सूखा सुरक्षा भुगतान स्वीकृत',
    why_paid_body: 'वर्षा 18.5 मिमी दर्ज हुई (35 मिमी सीमा से कम)। स्वतः दावा आपके बटुए में जमा हुआ।'
  },
  te: {
    user_label: 'రైతు వినియోగదారు',
    voice_cue: 'మాట్లాడి అడగండి / వినండి',
    voice_sub: 'మీ భాషలో పంట రక్షణ నియమాలు వినడానికి నొక్కండి',
    tile_policy: 'నా రక్షణ',
    tile_wallet: 'నా వాలెట్',
    tile_payout: 'నా పరిహారం',
    tile_sync: 'వైర్ సింక్',
    hero_title: 'నా పంట రక్షణ',
    safe_phone: 'ఈ పరికరంలో సురక్షితం',
    quiz_question: 'మీ ప్రాంతంలో 20 మి.మీ వర్షం మాత్రమే పడితే (35 మి.మీ కంటే తక్కువ), మీకు పరిహారం అందుతుందా?',
    quiz_pass: 'అభినందనలు! మీ సమాధానం సరైనది. మీ రక్షణ ప్రారంభమైంది.',
    quiz_retry: 'దయచేసి మళ్లీ వినండి. నిబంధనలను పరిశీలించి మళ్లీ ప్రయత్నించండి.',
    spend_success: 'ఆఫ్‌లైన్ చెల్లింపు పూర్తయింది! కొత్త నిల్వ:',
    why_paid_title: 'కరువు రక్షణ పరిహారం అందింది',
    why_paid_body: '18.5 మి.మీ వర్షపాతం నమోదైంది (35 మి.మీ పరిమితి కంటే తక్కువ). ఆటోమేటిక్ చెల్లింపు మీ వాలెట్‌కు చేరింది.'
  },
  en: {
    user_label: 'Farmer Account',
    voice_cue: 'Speak or Listen to Policy',
    voice_sub: 'Tap to hear crop protection terms in your language',
    tile_policy: 'My Protection',
    tile_wallet: 'My Wallet',
    tile_payout: 'My Payout',
    tile_sync: 'Wire Sync',
    hero_title: 'My Farm Protection',
    safe_phone: 'Safe on this device',
    quiz_question: 'If rainfall is 20 mm (below the 35 mm threshold), will you receive an automatic payout?',
    quiz_pass: 'Comprehension verified! Your crop protection is now active.',
    quiz_retry: "Let's hear that again. Please review the drought coverage rule.",
    spend_success: 'Offline payment successful! New balance:',
    why_paid_title: 'Drought Protection Payout Received',
    why_paid_body: 'Rainfall recorded at 18.5 mm (below 35 mm threshold). Automatic credit added to your local wallet.'
  }
};

const VOICE_SCRIPTS = {
  hi: {
    welcome: 'नमस्ते किसान भाई! खरीफ मूंगफली सूखा सुरक्षा योजना में आपका स्वागत है।',
    terms: 'प्रीमियम केवल ₹120 है। यदि 14 दिनों में वर्षा 35 मिमी से कम होती है, तो ₹5,000 तक का स्वतः भुगतान मिलेगा।'
  },
  te: {
    welcome: 'నమస్కారం రైతు సోదరా! ఖరీఫ్ వేరుశనగ కరువు రక్షణ పథకానికి స్వాగతం.',
    terms: 'ప్రీమియం ₹120 మాత్రమే. 14 రోజుల్లో వర్షం 35 మి.మీ కంటే తగ్గితే ₹5,000 వరకు పరిహారం అందుతుంది.'
  },
  en: {
    welcome: 'Welcome to KrishiSetu Kharif Groundnut Drought Shield.',
    terms: 'Premium is ₹120. If 14-day rainfall drops below 35 mm, you automatically receive up to ₹5,000.'
  }
};

// =========================================================================
// 1. INITIALIZATION & LIFECYCLE
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
  // Check for OAuth tokens in URL hash (from Google OAuth redirect/popup)
  if (window.location.hash && window.location.hash.includes('id_token=')) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const idToken = hashParams.get('id_token');
    const accessToken = hashParams.get('access_token');
    if (idToken) {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'GOOGLE_OAUTH_TOKEN', id_token: idToken, access_token: accessToken }, window.location.origin);
        window.close();
        return;
      } else {
        window.history.replaceState(null, '', window.location.pathname);
        handleGoogleCredentialResponse({ credential: idToken });
      }
    }
  }

  // Listen for tokens from OAuth popup
  window.addEventListener('message', (event) => {
    if (event.origin === window.location.origin && event.data && event.data.type === 'GOOGLE_OAUTH_TOKEN') {
      handleGoogleCredentialResponse({ credential: event.data.id_token });
    }
  });

  // Check for existing session in localStorage
  const savedSession = localStorage.getItem('krishisetu_session');
  if (savedSession) {
    try {
      currentUser = JSON.parse(savedSession);
      currentFarmerId = currentUser.email || currentUser.username || currentUser.user_id;
      clientWallet = new ClientWalletStorage(currentFarmerId);
      navigateTo('farmer');
    } catch (e) {
      localStorage.removeItem('krishisetu_session');
      navigateTo('landing');
    }
  } else {
    navigateTo('landing');
  }

  // Ensure default wallet state for authenticated users
  initWalletDemoState();

  setFarmerLanguage('hi');
  fetchProducts();
  fetchOracleFeeds();
  fetchMetrics();
  updateLiveProductPreview();
  initGoogleIdentity();
  
  setInterval(fetchMetrics, 3000);
});

function initWalletDemoState() {
  if (clientWallet.state.balance_inr === 0 && clientWallet.state.sequence === 0) {
    clientWallet.state.balance_inr = 4500;
    clientWallet.state.journal.push({
      event_type: 'PAYOUT_CREDIT',
      event_id: 'EVT_INIT_PAYOUT',
      amount_inr: 4500,
      policy_id: 'kharif-groundnut-deficit-v1',
      purpose: 'Drought Protection Payout',
      timestamp: new Date().toISOString()
    });
    clientWallet._saveState();
  }
}

// =========================================================================
// 2. ROUTING & VIEW NAVIGATION
// =========================================================================
function navigateTo(viewName) {
  currentView = viewName;
  
  // Hide all view sections
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.classList.add('active');

  // Topbar elements dynamic display
  const landingNav = document.getElementById('landing-nav-links');
  const modeSwitcher = document.getElementById('topbar-mode-switcher');
  const authSlot = document.getElementById('topbar-auth-slot');
  const btnFarmer = document.getElementById('btn-mode-farmer');
  const btnAdmin = document.getElementById('btn-mode-admin');

  if (viewName === 'landing') {
    if (landingNav) landingNav.style.display = 'flex';
    if (modeSwitcher) modeSwitcher.style.display = 'none';
    if (authSlot) {
      if (currentUser) {
        authSlot.innerHTML = `
          <button class="farmer-btn-primary" style="margin: 0; padding: 7px 16px; font-size: 13px; width: auto;" onclick="navigateTo('farmer')">
            Launch App &rarr;
          </button>
        `;
      } else {
        authSlot.innerHTML = `
          <button class="farmer-btn-primary" style="margin: 0; padding: 7px 16px; font-size: 13px; width: auto;" onclick="navigateTo('auth')">
            Sign In
          </button>
        `;
      }
    }
  } else if (viewName === 'auth') {
    if (landingNav) landingNav.style.display = 'none';
    if (modeSwitcher) modeSwitcher.style.display = 'none';
    if (authSlot) {
      authSlot.innerHTML = `
        <button class="farmer-lang-btn" onclick="navigateTo('landing')" style="border: 1px solid var(--border-subtle);">
          &larr; Back to Home
        </button>
      `;
    }
  } else if (viewName === 'farmer' || viewName === 'app') {
    if (!currentUser) {
      // Auto-assign guest profile if entering directly
      currentUser = {
        user_id: 'farmer_user',
        full_name: 'Verified Farmer User',
        email: 'farmer.user@gmail.com',
        picture: null
      };
      localStorage.setItem('krishisetu_session', JSON.stringify(currentUser));
    }

    if (landingNav) landingNav.style.display = 'none';
    if (modeSwitcher) modeSwitcher.style.display = 'flex';
    if (btnFarmer) btnFarmer.classList.add('active');
    if (btnAdmin) btnAdmin.classList.remove('active');

    updateFarmerProfileUI();
    updateFarmerUI();

    if (authSlot) {
      authSlot.innerHTML = `
        <button class="farmer-lang-btn" onclick="logoutUser()" style="color: var(--rose-500); border: 1px solid var(--border-subtle);">
          Sign Out
        </button>
      `;
    }
  } else if (viewName === 'admin') {
    if (landingNav) landingNav.style.display = 'none';
    if (modeSwitcher) modeSwitcher.style.display = 'flex';
    if (btnFarmer) btnFarmer.classList.remove('active');
    if (btnAdmin) btnAdmin.classList.add('active');

    fetchProducts();
    fetchOracleFeeds();
    fetchMetrics();

    if (authSlot) {
      authSlot.innerHTML = `
        <button class="farmer-lang-btn" onclick="navigateTo('landing')" style="border: 1px solid var(--border-subtle);">
          Home
        </button>
      `;
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchExperienceMode(mode) {
  navigateTo(mode === 'admin' ? 'admin' : 'farmer');
}

function scrollToSection(id) {
  if (currentView !== 'landing') {
    navigateTo('landing');
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  } else {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

function openFarmerScreen(screenId) {
  currentFarmerScreen = screenId;
  document.querySelectorAll('.farmer-screen').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`screen-${screenId}`);
  if (target) target.classList.add('active');

  // Update tabs active states
  document.querySelectorAll('.f-nav-item').forEach(el => el.classList.remove('active'));
  const navBtn = document.getElementById(`fnav-${screenId}`);
  if (navBtn) navBtn.classList.add('active');

  updateFarmerUI();
}

function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab-pane').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.admin-tab-btn').forEach(el => el.classList.remove('active'));

  const pane = document.getElementById(`admin-tab-${tabId}`);
  if (pane) pane.classList.add('active');

  const buttons = document.querySelectorAll('.admin-tab-btn');
  buttons.forEach(b => {
    if (b.innerText.toLowerCase().includes(tabId.substring(0, 4))) {
      b.classList.add('active');
    }
  });

  if (tabId === 'oracles') fetchOracleFeeds();
  if (tabId === 'metrics') fetchMetrics();
}

// =========================================================================
// 3. FARMER LOCALIZATION & SPEECH SYNTHESIZER
// =========================================================================
function setFarmerLanguage(lang) {
  currentLang = lang;
  
  ['hi', 'te', 'en'].forEach(l => {
    const btn = document.getElementById(`lang-${l}`);
    if (btn) {
      if (l === lang) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  });

  const i18n = I18N[lang] || I18N.hi;

  const voiceCueElem = document.getElementById('f-voice-cue');
  if (voiceCueElem) voiceCueElem.innerText = i18n.voice_cue;

  const voiceSubElem = document.getElementById('f-voice-sub');
  if (voiceSubElem) voiceSubElem.innerText = i18n.voice_sub;

  const compQ = document.getElementById('comp-question-text');
  if (compQ) compQ.innerText = `"${i18n.quiz_question}"`;
}

function getPrompt(key) {
  const scripts = VOICE_SCRIPTS[currentLang] || VOICE_SCRIPTS.hi;
  if (key === 'product_intro') return scripts.welcome;
  if (key === 'trigger_disclosure') return scripts.terms;
  return '';
}

function speakText(text, onEnd) {
  const waveEl = document.getElementById('voice-wave');
  if (waveEl) waveEl.classList.add('active');

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.92;
    
    utterance.onend = () => {
      if (waveEl) waveEl.classList.remove('active');
      if (onEnd) onEnd();
    };
    
    utterance.onerror = () => {
      if (waveEl) waveEl.classList.remove('active');
      if (onEnd) onEnd();
    };
    
    window.speechSynthesis.speak(utterance);
  } else {
    if (onEnd) onEnd();
  }
}

function speakHelpTopic(topic) {
  const scripts = {
    hi: {
      protection: 'फसल सुरक्षा नियम: यदि 14 दिनों में कुल वर्षा 35 मिमी सीमा से कम होती है, तो स्वचालित दावा आपके स्थानीय बटुए में जमा होगा।',
      wallet: 'बटुए की जानकारी: आपकी धनराशि इस फोन पर सुरक्षित है। आप बिना इंटरनेट के प्रमाणित बीज और खाद दुकानों पर खर्च कर सकते हैं।',
      offline: 'ऑफ़लाइन सुरक्षा: रोजमर्रा के कार्य के लिए इंटरनेट की आवश्यकता नहीं है। नेटवर्क आने पर यह स्वतः सिंक हो जाएगा।'
    },
    te: {
      protection: 'పంట రక్షణ నియమాలు: 14 రోజుల్లో వర్షం 35 మి.మీ కంటే తగ్గితే, ఆటోమేటిక్ పరిహారం మీ వాలెట్‌లో జమ అవుతుంది.',
      wallet: 'వాలెట్ సమాచారం: మీ నిధులు సురక్షితంగా ఉన్నాయి. భాగస్వామ్య దుకాణాల్లో ఆఫ్‌లైన్‌లో వాడుకోవచ్చు.',
      offline: 'ఆఫ్‌లైన్ భద్రత: ఇంటర్నెట్ అవసరం లేదు. నెట్‌వర్క్ వచ్చినప్పుడు ఆటోమేటిక్‌గా సింక్ అవుతుంది.'
    },
    en: {
      protection: 'Protection rules: If 14-day rainfall drops below 35 mm, automatic payout is credited directly to your offline wallet.',
      wallet: 'Wallet guide: Your balance is cryptographically preserved. Spend offline at certified agricultural partner shops anytime.',
      offline: 'Offline safety: No continuous network connection required. Syncs automatically when network appears.'
    }
  };

  const currentTopicScripts = scripts[currentLang] || scripts.hi;

  if (topic === 'all') {
    const fullSpeech = `${currentTopicScripts.protection} ${currentTopicScripts.wallet} ${currentTopicScripts.offline}`;
    speakText(fullSpeech);
  } else if (currentTopicScripts[topic]) {
    speakText(currentTopicScripts[topic]);
  }
}

function updateLiveProductPreview() {
  const name = document.getElementById('p-name')?.value || 'New Crop Shield';
  const crop = document.getElementById('p-crop')?.value || 'Crop / Region';
  const threshold = document.getElementById('p-threshold')?.value || '35';
  const premium = document.getElementById('p-premium')?.value || '150';
  const maxPayout = document.getElementById('p-maxpayout')?.value || '5000';
  const formula = document.getElementById('p-formula')?.value || 'LINEAR_PRO_RATA';

  const pvName = document.getElementById('pv-name');
  const pvCrop = document.getElementById('pv-crop');
  const pvThreshold = document.getElementById('pv-threshold');
  const pvPremium = document.getElementById('pv-premium');
  const pvMaxPayout = document.getElementById('pv-maxpayout');
  const pvFormula = document.getElementById('pv-formula');

  if (pvName) pvName.innerText = name;
  if (pvCrop) pvCrop.innerText = crop;
  if (pvThreshold) pvThreshold.innerText = `Rain ≤ ${threshold} mm`;
  if (pvPremium) pvPremium.innerText = `₹${Number(premium).toLocaleString('en-IN')}`;
  if (pvMaxPayout) pvMaxPayout.innerText = `₹${Number(maxPayout).toLocaleString('en-IN')}`;
  if (pvFormula) pvFormula.innerText = formula;
}

function triggerFarmerVoiceAssistant() {
  const scripts = VOICE_SCRIPTS[currentLang] || VOICE_SCRIPTS.hi;
  const micBtn = document.getElementById('f-mic-button');
  if (micBtn) micBtn.classList.add('listening');

  const fullAudio = `${scripts.welcome} ${scripts.terms}`;
  speakText(fullAudio, () => {
    if (micBtn) micBtn.classList.remove('listening');
    openFarmerScreen('comprehension');
  });
}

function submitFarmerQuiz(choice) {
  const i18n = I18N[currentLang] || I18N.hi;
  const feedbackBox = document.getElementById('comp-feedback-box');
  const isCorrect = choice === '1';

  feedbackBox.style.display = 'block';

  if (isCorrect) {
    feedbackBox.style.background = 'rgba(16, 185, 129, 0.2)';
    feedbackBox.style.border = '1px solid var(--emerald-500)';
    feedbackBox.style.color = 'var(--emerald-400)';
    feedbackBox.innerHTML = `✓ ${i18n.quiz_pass}`;
    
    speakText(i18n.quiz_pass);

    if (clientWallet.state.policies.length === 0) {
      clientWallet.bindPolicy({
        product_id: 'kharif-groundnut-deficit-v1',
        name: 'Kharif Groundnut Drought Shield',
        crop: 'Groundnut (मूंगफली)',
        premium_inr: 120,
        max_payout_inr: 5000
      });
      updateFarmerUI();
    }
  } else {
    feedbackBox.style.background = 'rgba(239, 68, 68, 0.2)';
    feedbackBox.style.border = '1px solid var(--rose-500)';
    feedbackBox.style.color = 'var(--rose-500)';
    feedbackBox.innerHTML = `Notice: ${i18n.quiz_retry}`;

    const scripts = VOICE_SCRIPTS[currentLang] || VOICE_SCRIPTS.hi;
    speakText(`${i18n.quiz_retry} ${scripts.terms}`);
  }
}

// =========================================================================
// 4. FARMER WALLET & ACTIVITY LEDGER
// =========================================================================
function updateFarmerProfileUI() {
  if (!currentUser) return;

  const nameElem = document.getElementById('f-user-name');
  const emailElem = document.getElementById('f-user-email');
  const avatarSlot = document.getElementById('f-avatar-slot');

  if (nameElem) nameElem.innerText = currentUser.full_name || currentUser.username || 'Farmer User';
  if (emailElem) emailElem.innerText = currentUser.email || currentUser.user_id || 'farmer.user@gmail.com';

  if (avatarSlot && currentUser.picture) {
    avatarSlot.innerHTML = `<img src="${currentUser.picture}" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">`;
  }
}

function updateFarmerUI() {
  const state = clientWallet.state;

  const formattedBal = `₹${(state.balance_inr || 0).toLocaleString('en-IN')}`;
  const heroBal = document.getElementById('f-hero-balance');
  if (heroBal) heroBal.innerText = formattedBal;

  const walletBal = document.getElementById('f-wallet-balance');
  if (walletBal) walletBal.innerText = formattedBal;

  const wireInfo = clientWallet.buildCompactHexPayload();
  const wireBytesElem = document.getElementById('f-sync-wire-bytes');
  if (wireBytesElem) wireBytesElem.innerText = wireInfo.raw_bytes;

  const landWireSize = document.getElementById('land-wire-size');
  if (landWireSize) landWireSize.innerText = `${wireInfo.raw_bytes} B`;

  const pendingItemsElem = document.getElementById('f-pending-sync-items');
  if (pendingItemsElem) {
    pendingItemsElem.innerText = `${wireInfo.event_count} item${wireInfo.event_count === 1 ? '' : 's'} waiting`;
  }

  const syncStatusElem = document.getElementById('f-sync-status-text');
  if (syncStatusElem) {
    if (isSimulatedOffline) {
      syncStatusElem.innerText = 'Working Offline (Saved locally)';
      syncStatusElem.style.color = 'var(--sky-400)';
    } else {
      syncStatusElem.innerText = wireInfo.event_count > 0 ? 'Ready to Sync (2G Online)' : 'All Synced ✓';
      syncStatusElem.style.color = 'var(--emerald-400)';
    }
  }

  // Populate Activity Lists
  const activityList = document.getElementById('f-recent-activity-list');
  const activityListFull = document.getElementById('f-recent-activity-list-full');
  
  [activityList, activityListFull].forEach(container => {
    if (!container) return;
    container.innerHTML = '';
    const journal = (state.journal || []).slice().reverse().slice(0, 10);
    
    if (journal.length === 0) {
      container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 14px;">No transactions recorded in offline ledger</div>';
    } else {
      journal.forEach(item => {
        const isCredit = item.event_type === 'PAYOUT_CREDIT';
        const sign = isCredit ? '+' : '-';
        const color = isCredit ? 'var(--emerald-400)' : 'var(--text-primary)';
        const row = document.createElement('div');
        row.className = 'flow-step-item';
        row.style.cssText = 'flex-direction: row; justify-content: space-between; align-items: center;';
        row.innerHTML = `
          <div>
            <div style="font-weight: 700; font-size: 14px; color: ${color}; font-family: var(--font-mono);">${sign} ₹${(item.amount_inr || 0).toLocaleString('en-IN')}</div>
            <div style="font-size: 12px; color: var(--text-secondary);">${item.purpose || item.event_type} &bull; ${new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
          <span class="brand-tag" style="font-size: 10px;">Safe Offline</span>
        `;
        container.appendChild(row);
      });
    }
  });
}

function executeFarmerSpend() {
  const amountInput = document.getElementById('f-spend-amount');
  const itemSelect = document.getElementById('f-spend-item');
  const amount = Number(amountInput.value);
  const itemName = itemSelect.value;
  const i18n = I18N[currentLang] || I18N.hi;

  if (!amount || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  try {
    clientWallet.spendOffline(amount, 'Agri-Shop Partner', itemName);
    updateFarmerUI();
    const msg = `${i18n.spend_success} ₹${clientWallet.state.balance_inr}`;
    speakText(msg);
    alert(`✓ Offline Payment Authorized for ${itemName} (₹${amount}). Recorded in local offline ledger.`);
  } catch (err) {
    alert(`Spend Rejected: ${err.message}`);
  }
}

function toggleSimulatedNetwork() {
  isSimulatedOffline = !isSimulatedOffline;
  const netIndicator = document.getElementById('net-indicator');
  const netText = document.getElementById('net-indicator-text');
  const heroOfflineStatus = document.getElementById('f-hero-offline-status');

  if (isSimulatedOffline) {
    netIndicator.style.background = 'rgba(239, 68, 68, 0.15)';
    netIndicator.style.color = 'var(--rose-500)';
    netIndicator.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    netText.innerText = 'OFFLINE (Zero Signal)';
    if (heroOfflineStatus) heroOfflineStatus.innerText = 'Working Offline';
  } else {
    netIndicator.style.background = 'rgba(16, 185, 129, 0.15)';
    netIndicator.style.color = 'var(--emerald-400)';
    netIndicator.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    netText.innerText = '2G ONLINE (40 kbps)';
    if (heroOfflineStatus) heroOfflineStatus.innerText = 'Safe on this device & spendable offline';
  }

  updateFarmerUI();
}

// =========================================================================
// 5. COMPACT WIRE PROTOCOL SYNC (<2KB)
// =========================================================================
async function triggerClientSync() {
  const wireInfo = clientWallet.buildCompactHexPayload();
  
  if (wireInfo.event_count === 0) {
    alert('✓ All events are already synced! (0 pending)');
    return;
  }

  if (isSimulatedOffline) {
    alert('🟢 WORKING OFFLINE: Your events are safely preserved in offline storage. They will automatically sync when network is restored.');
    return;
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-farmer-id': currentFarmerId
      },
      body: JSON.stringify({ payload_hex: wireInfo.hex })
    });

    const data = await res.json();
    if (data.success) {
      clientWallet.ackSync(data.server_sequence);
      updateFarmerUI();
      fetchMetrics();
      alert(`🎉 Sync Complete! Reconciled ${wireInfo.event_count} events over compact ${wireInfo.raw_bytes} byte payload.`);
    } else {
      alert(`Sync Error: ${data.error}`);
    }
  } catch (err) {
    alert(`Sync Network Request Failed: ${err.message}`);
  }
}

// =========================================================================
// 6. ADMIN / JUROR CONSOLE
// =========================================================================
async function fetchProducts() {
  try {
    const res = await fetch('/api/products');
    const products = await res.json();
    if (products.length > 0) activeProduct = products[0];

    const listContainer = document.getElementById('admin-product-list');
    const evalSelect = document.getElementById('adm-eval-policy');

    if (listContainer) listContainer.innerHTML = '';
    if (evalSelect) evalSelect.innerHTML = '';

    products.forEach(p => {
      if (listContainer) {
        const card = document.createElement('div');
        card.style.cssText = 'background: var(--bg-dark); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);';
        card.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <strong style="color: #fff;">${p.name}</strong>
            <span class="brand-tag">${p.crop}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-secondary);">
            <code>${p.product_id}</code> &bull; Region: ${p.region} &bull; Threshold: ${p.rainfall_threshold_mm}mm
          </div>
          <div style="font-size: 12px; color: var(--emerald-400); margin-top: 4px;">
            Max Payout: ₹${p.max_payout_inr} &bull; Premium: ₹${p.premium_inr} &bull; Formula: ${p.payout_formula ? p.payout_formula.type : 'LINEAR'}
          </div>
        `;
        listContainer.appendChild(card);
      }

      if (evalSelect) {
        const opt = document.createElement('option');
        opt.value = p.product_id;
        opt.innerText = `${p.name} (${p.product_id})`;
        evalSelect.appendChild(opt);
      }
    });
  } catch (err) {}
}

async function handleProductCreation(e) {
  e.preventDefault();
  const productData = {
    product_id: document.getElementById('p-id').value.trim(),
    name: document.getElementById('p-name').value.trim(),
    crop: document.getElementById('p-crop').value.trim(),
    region: 'Vidarbha / Maharashtra',
    season: 'Kharif 2026',
    premium_inr: Number(document.getElementById('p-premium').value),
    max_payout_inr: Number(document.getElementById('p-maxpayout').value),
    rainfall_threshold_mm: Number(document.getElementById('p-threshold').value),
    measurement_window_days: 14,
    payout_formula: {
      type: document.getElementById('p-formula').value,
      threshold_mm: Number(document.getElementById('p-threshold').value),
      max_payout_inr: Number(document.getElementById('p-maxpayout').value)
    },
    oracle_requirements: {
      min_sources: 2,
      max_stale_minutes: 180,
      max_allowed_variance_mm: 14.0
    },
    effective_from: new Date().toISOString(),
    effective_to: '2026-12-31T23:59:59Z',
    version: '1.0.0',
    description: 'Dynamic product registered live with zero code redeployment.'
  };

  try {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productData)
    });
    const result = await res.json();
    if (result.success) {
      alert(`✓ Product "${productData.name}" deployed dynamically with ZERO code changes!`);
      fetchProducts();
      switchAdminTab('overview');
    } else {
      alert(`Error: ${result.error}`);
    }
  } catch (err) {
    alert(`Product registration failed: ${err.message}`);
  }
}

async function fetchOracleFeeds() {
  try {
    const res = await fetch('/api/oracles');
    const data = await res.json();
    const grid = document.getElementById('admin-oracle-cards');
    if (!grid) return;

    grid.innerHTML = '';
    (data.observations || []).forEach(src => {
      const card = document.createElement('div');
      card.className = 'admin-card';
      const isHealthy = src.status === 'ONLINE';
      const statusColor = isHealthy ? 'var(--emerald-400)' : 'var(--rose-500)';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 14px; color: #fff;">${src.name}</strong>
          <span class="brand-tag" style="background: ${isHealthy ? 'var(--emerald-glow)' : 'var(--rose-glow)'}; color: ${statusColor};">
            ${src.status}
          </span>
        </div>
        <div style="font-size: 26px; font-weight: 800; color: var(--sky-400); margin: 6px 0; font-family: var(--font-mono);">
          ${src.rainfall_mm !== null ? src.rainfall_mm.toFixed(1) + ' mm' : 'UNAVAILABLE'}
        </div>
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.6;">
          <div>Source Type: <code>${src.type}</code></div>
          <div>Confidence Score: ${(src.confidence * 100).toFixed(0)}%</div>
          <div>Signature: <code>${src.signature ? src.signature.substring(0, 16) + '...' : 'NONE'}</code></div>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {}
}

async function handleChaosSelect(chaosType) {
  await fetch('/api/oracles/reset', { method: 'POST' });
  const now = new Date().toISOString();

  if (chaosType === 'ORACLE_A_MANIPULATED') {
    await fetch('/api/oracles/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: 'AWS_IMD_MANDAL',
        override: { rainfall_mm: 0.0, forced_status: 'MANIPULATED', observation_timestamp: now }
      })
    });
  } else if (chaosType === 'ORACLE_B_STALE') {
    const staleTime = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
    await fetch('/api/oracles/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: 'SATELLITE_GPM_GRID',
        override: { observation_timestamp: staleTime }
      })
    });
  } else if (chaosType === 'ORACLE_C_OFFLINE') {
    await fetch('/api/oracles/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: 'PANCHAYAT_IOT_GUAGE',
        override: { status: 'UNAVAILABLE', rainfall_mm: null }
      })
    });
  } else if (chaosType === 'TWO_WAY_SPLIT') {
    await fetch('/api/oracles/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: 'AWS_IMD_MANDAL', override: { rainfall_mm: 12.0 } })
    });
    await fetch('/api/oracles/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: 'SATELLITE_GPM_GRID', override: { rainfall_mm: 88.0 } })
    });
  }

  fetchOracleFeeds();
}

async function triggerPayoutEvaluation() {
  const rainfall = Number(document.getElementById('adm-eval-rainfall').value);
  const productId = document.getElementById('adm-eval-policy').value;

  try {
    const res = await fetch('/api/payout/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        farmer_id: currentFarmerId,
        baseline_rainfall_mm: rainfall
      })
    });

    const data = await res.json();
    const decision = data.decision;
    const trail = data.reconstruction;

    const resultBox = document.getElementById('adm-eval-result-box');
    resultBox.innerHTML = `
      <div style="font-weight: 800; font-size: 14px; margin-bottom: 6px; color: ${decision.triggered ? 'var(--emerald-400)' : 'var(--amber-500)'};">
        ${decision.triggered ? 'PAYOUT SETTLED (₹' + decision.payout_amount_inr + ')' : 'NO PAYOUT TRIGGERED (' + decision.decision_reason + ')'}
      </div>
      <div style="color: var(--text-secondary);">
        Consensus Status: <code>${decision.consensus_status}</code> &bull; Aggregated Rainfall: ${decision.aggregated_rainfall_mm !== null ? decision.aggregated_rainfall_mm + 'mm' : 'N/A'} &bull; Latency: ${data.latency_ms} ms
      </div>
    `;

    if (decision.triggered && decision.payout_amount_inr > 0) {
      clientWallet.creditPayout(decision.payout_amount_inr, decision.payout_id, decision.policy_id);
      updateFarmerUI();

      const whyRain = document.getElementById('f-why-rain');
      if (whyRain) whyRain.innerText = `${decision.aggregated_rainfall_mm} mm`;

      const whyPayout = document.getElementById('f-why-payout');
      if (whyPayout) whyPayout.innerText = `₹${decision.payout_amount_inr} Credited`;

      const fPayoutAmount = document.getElementById('f-payout-amount');
      if (fPayoutAmount) fPayoutAmount.innerText = `₹${decision.payout_amount_inr}`;
    }

    renderJurorAuditDAG(trail);
    switchAdminTab('reconstruct');
    fetchMetrics();
  } catch (err) {
    alert(`Settlement execution error: ${err.message}`);
  }
}

function renderJurorAuditDAG(trail) {
  currentReconstructionTrail = trail;
  const container = document.getElementById('juror-dag-container');
  if (!container) return;

  if (!trail || !trail.steps || trail.steps.length === 0) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-secondary);">No DAG reconstruction available</div>';
    return;
  }

  container.innerHTML = '';
  trail.steps.forEach(step => {
    const isRejected = step.status === 'REJECTED';
    const node = document.createElement('div');
    node.className = `dag-step-card ${isRejected ? 'rejected' : ''}`;
    node.innerHTML = `
      <div class="dag-header">
        <span style="font-weight: 800;">Step ${step.step_index}: ${step.title}</span>
        <span class="brand-tag" style="background: ${isRejected ? 'var(--rose-glow)' : 'var(--emerald-glow)'}; color: ${isRejected ? 'var(--rose-500)' : 'var(--emerald-400)'};">
          ${step.status}
        </span>
      </div>
      <div style="font-size: 13px; color: #fff; margin-bottom: 8px;">${step.narrative}</div>
      <pre style="background: var(--bg-dark); padding: 8px; border-radius: 6px; font-size: 11px; color: var(--sky-400); max-height: 140px; overflow: auto; border: 1px solid var(--border-subtle);">${JSON.stringify(step.details, null, 2)}</pre>
    `;
    container.appendChild(node);
  });
}

async function runScenario(scenarioId) {
  try {
    const res = await fetch('/api/demo/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId })
    });
    const data = await res.json();
    
    const outputElem = document.getElementById('admin-scenario-output');
    if (outputElem) outputElem.innerText = JSON.stringify(data, null, 2);

    if (data.trail) {
      renderJurorAuditDAG(data.trail);
    }
    fetchOracleFeeds();
    fetchMetrics();
  } catch (err) {
    alert(`Scenario execution failed: ${err.message}`);
  }
}

async function fetchMetrics() {
  try {
    const [jsonRes, rawRes, dbRes] = await Promise.all([
      fetch('/api/metrics/json'),
      fetch('/metrics'),
      fetch('/api/db/status')
    ]);

    const metricsData = await jsonRes.json();
    const rawText = await rawRes.text();
    const dbStatus = await dbRes.json();

    const kpiPayouts = document.getElementById('kpi-payouts-count');
    if (kpiPayouts) kpiPayouts.innerText = metricsData.counters.insurance_payouts_triggered_total || 0;

    const kpiAnomalies = document.getElementById('kpi-anomalies-count');
    if (kpiAnomalies) kpiAnomalies.innerText = metricsData.counters.oracle_manipulation_rejections_total || 0;

    const rawMetricsElem = document.getElementById('admin-raw-metrics');
    if (rawMetricsElem) rawMetricsElem.innerText = rawText;

    const dbPill = document.getElementById('db-conn-pill');
    const dbMode = document.getElementById('db-mode-val');
    if (dbPill && dbStatus) {
      dbPill.innerText = dbStatus.connected ? 'Connected' : 'Active Store';
      dbPill.style.background = 'var(--emerald-glow)';
      dbPill.style.color = 'var(--emerald-400)';
      if (dbMode) dbMode.innerText = dbStatus.mode || 'MONGODB_PERSISTENT_ADAPTER';
    }
  } catch (e) {}
}

// =========================================================================
// 7. AUTHENTICATION (GOOGLE OAUTH 2.0 & EMAIL/PASSWORD)
// =========================================================================
let googleAuthInitialized = false;

async function initGoogleIdentity() {
  try {
    const res = await fetch('/api/auth/config');
    const config = await res.json();
    window.GOOGLE_CLIENT_ID = config.google_client_id || '';

    if (window.GOOGLE_CLIENT_ID && window.google && window.google.accounts) {
      google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      // Render official Google button
      const btnContainer = document.getElementById('g_id_signin_container');
      if (btnContainer) {
        google.accounts.id.renderButton(btnContainer, {
          theme: 'filled_black',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width: 320
        });
        const fallbackBtn = document.getElementById('btn-google-fallback');
        if (fallbackBtn) fallbackBtn.style.display = 'none';
      }

      googleAuthInitialized = true;
    }
  } catch (e) {}
}

async function handleGoogleCredentialResponse(response) {
  if (!response || (!response.credential && !response.access_token)) return;

  try {
    const payload = { device_id: 'DEV_WEB_CLIENT' };
    if (response.credential) payload.credential = response.credential;
    if (response.access_token) payload.access_token = response.access_token;

    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success && data.user) {
      applyUserSession(data.user);
    } else {
      alert(`Google Auth Failed: ${data.message || data.error}`);
    }
  } catch (err) {
    alert(`Google Authentication Error: ${err.message}`);
  }
}

function applyUserSession(user) {
  currentUser = user;
  currentFarmerId = user.email || user.username || user.user_id;
  localStorage.setItem('krishisetu_session', JSON.stringify(user));

  clientWallet = new ClientWalletStorage(currentFarmerId);
  initWalletDemoState();

  updateFarmerProfileUI();
  updateFarmerUI();
  navigateTo('farmer');

  const welcomeAudio = currentLang === 'hi'
    ? `स्वागत है ${user.full_name || 'किसान भाई'}! आपकी फसल सुरक्षा तैयार है।`
    : `Welcome ${user.full_name || 'Farmer'}! Your crop protection dashboard is ready.`;
  speakText(welcomeAudio);
}

function logoutUser() {
  currentUser = null;
  localStorage.removeItem('krishisetu_session');
  navigateTo('landing');
}

async function triggerGoogleSignIn() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2 && window.GOOGLE_CLIENT_ID) {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: window.GOOGLE_CLIENT_ID,
      scope: 'openid profile email',
      callback: (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          handleGoogleCredentialResponse({ access_token: tokenResponse.access_token });
        }
      },
      error_callback: (err) => {
        console.warn('[Google OAuth Error]', err);
      }
    });
    tokenClient.requestAccessToken();
    return;
  }

  if (window.google && window.google.accounts && window.GOOGLE_CLIENT_ID) {
    google.accounts.id.prompt();
    return;
  }

  const userChoice = prompt(
    "Google OAuth 2.0 Sign In:\n• Enter your Google email address (or your Google Cloud Client ID):",
    window.GOOGLE_CLIENT_ID || "farmer.user@gmail.com"
  );

  if (userChoice === null) return;
  const cleanInput = userChoice.trim();

  if (cleanInput.includes('.googleusercontent.com')) {
    window.GOOGLE_CLIENT_ID = cleanInput;
    initGoogleIdentity();
    return;
  }

  const email = cleanInput || "farmer.user@gmail.com";
  const name = email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const googleProfile = {
    sub: `GOOG_${simpleHash(email)}`,
    email: email,
    name: name,
    picture: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`
  };

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: googleProfile,
        device_id: 'DEV_WEB_CLIENT'
      })
    });

    const data = await res.json();
    if (data.success && data.user) {
      applyUserSession(data.user);
    } else {
      alert(`Google Auth Error: ${data.message || data.error}`);
    }
  } catch (err) {
    alert(`Google Sign-In failed: ${err.message}`);
  }
}

async function handleEmailPasswordAuth(e) {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const statusBox = document.getElementById('auth-status-box');

  statusBox.style.display = 'block';
  statusBox.style.background = 'rgba(56, 189, 248, 0.15)';
  statusBox.style.color = 'var(--sky-400)';
  statusBox.innerText = 'Authenticating...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: username,
        password: password,
        device_id: 'DEV_WEB_CLIENT'
      })
    });

    const data = await res.json();
    if (data.success) {
      statusBox.style.background = 'rgba(16, 185, 129, 0.15)';
      statusBox.style.color = 'var(--emerald-400)';
      statusBox.innerText = '✓ Authentication successful! Loading dashboard...';

      setTimeout(() => {
        applyUserSession({
          user_id: data.user_id,
          username: data.username,
          full_name: data.full_name || username,
          email: username.includes('@') ? username : `${username}@krishisetu.in`
        });
      }, 500);
    } else {
      statusBox.style.background = 'rgba(244, 63, 94, 0.15)';
      statusBox.style.color = 'var(--rose-500)';
      statusBox.innerText = `Sign In Failed: ${data.message || data.error}`;
    }
  } catch (err) {
    statusBox.style.background = 'rgba(244, 63, 94, 0.15)';
    statusBox.style.color = 'var(--rose-500)';
    statusBox.innerText = `Network error: ${err.message}`;
  }
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
