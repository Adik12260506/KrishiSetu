/**
 * Voice Accessibility Engine
 * Provides regional voice prompt states, disclosures, and comprehension routing.
 */

const { COMPREHENSION_QUESTION_BANK } = require('./comprehension_quiz');

const VOICE_PROMPTS = {
  hi: {
    greeting: 'नमस्ते किसान भाई! कृषि-सेतु फसल सुरक्षा में आपका स्वागत है।',
    product_intro: 'खरीफ मूंगफली सूखा सुरक्षा योजना। यदि 14 दिनों में वर्षा 35 मिमी से कम होती है, तो आपको ₹5,000 तक का स्वतः भुगतान मिलेगा।',
    premium_disclosure: 'इस सुरक्षा का प्रीमियम केवल ₹120 है। कोई कागजी कार्रवाई या सर्वेक्षक की आवश्यकता नहीं है।',
    trigger_disclosure: 'मौसम केंद्रों और उपग्रह द्वारा वर्षा कम दर्ज होते ही पैसा सीधे आपके ऑफलाइन वॉलेट में जमा हो जाएगा।',
    quiz_intro: 'योजना शुरू करने से पहले, कृपया इस छोटे प्रश्न का उत्तर दें।',
    passed: 'बधाई हो! आपकी समझ की पुष्टि हो गई है। आपकी पॉलिसी सक्रिय हो गई है।',
    failed: 'गलत उत्तर। आइए नियम दोबारा सुनें या 1 दबाकर पुनः प्रयास करें।',
    offline_payout_alert: 'खुशखबरी! आपके क्षेत्र में कम वर्षा के कारण ₹4,500 का बीमा आपके वॉलेट में जमा हो गया है।'
  },
  te: {
    greeting: 'నమస్కారం రైతు సోదరా! కృషి-సేతు పంట రక్షణకు స్వాగతం.',
    product_intro: 'ఖరీఫ్ వేరుశనగ కరువు రక్షణ పథకం. 14 రోజుల్లో వర్షం 35 మి.మీ కంటే తగ్గితే, మీకు ₹5,000 వరకు ఆటోమేటిక్ పరిహారం అందుతుంది.',
    premium_disclosure: 'ఈ బీమా ప్రీమియం కేవలం ₹120 మాత్రమే. సర్వేయర్లు లేదా దరఖాస్తులు అవసరం లేదు.',
    trigger_disclosure: 'వర్షపాతం తగ్గగానే పరిహార సొమ్ము నేరుగా మీ ఆఫ్‌లైన్ వాలెట్‌లో జమ అవుతుంది.',
    quiz_intro: 'పాలసీని ప్రారంభించే ముందు, దయచేసి ఈ చిన్న ప్రశ్నకు సమాధానం ఇవ్వండి.',
    passed: 'అభినందనలు! మీ సమాధానం సరైనది. మీ పంట బీమా పాలసీ ప్రారంభమైంది.',
    failed: 'సరికాని సమాధానం. దయచేసి నిబంధనలను మళ్లీ వినండి లేదా 1 నొక్కండి.',
    offline_payout_alert: 'శుభవార్త! మీ ప్రాంతంలో కరువు పరిస్థితి వల్ల ₹4,500 మీ వాలెట్‌లో జమ అయింది.'
  },
  or: {
    greeting: 'ନମସ୍କାର କୃଷକ ଭାଇ! କୃଷି-ସେତୁ ଫସଲ ସୁରକ୍ଷା ଯୋଜନାରେ ଆପଣଙ୍କୁ ସ୍ୱାଗତ।',
    product_intro: 'ଖରିଫ ଚିନାବାଦାମ ମରୁଡ଼ି ସୁରକ୍ଷା ଯୋଜନା। ଯଦି ୧୪ ଦିନରେ ବର୍ଷା ୩୫ ମିଲିମିଟରରୁ କମ ହୁଏ, ତେବେ ଆପଣଙ୍କୁ ₹୫,୦୦୦ ପର୍ଯ୍ୟନ୍ତ ସ୍ୱତଃ ପରିଶୋଧ ମିଳିବ।',
    premium_disclosure: 'ଏହି ବୀମାର ପ୍ରିମିୟମ ମାତ୍ର ₹୧୨୦। କୌଣସି କାଗଜପତ୍ର କିମ୍ବା ସର୍ଭେୟର ପରିଦର୍ଶନର ଆବଶ୍ୟକତା ନାହିଁ।',
    trigger_disclosure: 'ବର୍ଷା କମ ହେବା ମାତ୍ରେ ଟଙ୍କା ସିଧାସଳଖ ଆପଣଙ୍କ ଅଫଲାଇନ୍ ୱାଲେଟରେ ଜମା ହୋଇଯିବ।',
    quiz_intro: 'ଯୋଜନା ସକ୍ରିୟ କରିବା ପୂର୍ବରୁ, ଦୟାକରି ଏହି ଛୋଟ ପ୍ରଶ୍ନର ଉତ୍ତର ଦିଅନ୍ତୁ।',
    passed: 'ଅଭିନନ୍ଦନ! ଆପଣଙ୍କ ବୁଝାମଣା ନିଶ୍ଚିତ ହୋଇଛି। ଆପଣଙ୍କ ପଲିସି ସକ୍ରିୟ ହୋଇଛି।',
    failed: 'ଭୁଲ ଉତ୍ତର। ନିୟମ ପୁନର୍ବାର ଶୁଣିବା ପାଇଁ କିମ୍ବା ପୁନଃ ଚେଷ୍ଟା କରିବାକୁ ୧ ଦବାନ୍ତୁ।',
    offline_payout_alert: 'ଖୁସି ଖବର! ଆପଣଙ୍କ ଅଞ୍ଚଳରେ ମରୁଡ଼ି ପାଇଁ ₹୪,୫୦୦ ବୀମା ଟଙ୍କା ୱାଲେଟରେ ଜମା ହୋଇଛି।'
  },
  en: {
    greeting: 'Welcome to KrishiSetu Parametric Crop Protection.',
    product_intro: 'Kharif Groundnut Drought Shield. If rainfall over 14 days drops below 35 mm, you automatically receive up to ₹5,000 payout.',
    premium_disclosure: 'The one-time premium is ₹120. Zero paperwork or surveyor visits required.',
    trigger_disclosure: 'Payout is calculated by independent weather oracles and credited directly to your offline spendable wallet.',
    quiz_intro: 'Before activating your policy, please answer this brief comprehension check.',
    passed: 'Comprehension verified! Your policy is now active and protected.',
    failed: 'Incorrect answer. Let us review the coverage terms or press 1 to retry.',
    offline_payout_alert: 'Good news! A drought payout of ₹4,500 has been credited to your offline wallet.'
  }
};

class VoiceSessionController {
  constructor(language = 'hi') {
    this.language = language;
    this.currentStep = 'IDLE'; // IDLE, INTRO, DISCLOSURE, QUIZ, BIND_CONFIRMED, FAILED
    this.comprehensionPassed = false;
  }

  setLanguage(lang) {
    if (['hi', 'te', 'or', 'en'].includes(lang)) {
      this.language = lang;
    }
  }

  getPrompt(key) {
    const langPack = VOICE_PROMPTS[this.language] || VOICE_PROMPTS.en;
    return langPack[key] || '';
  }

  getCurrentQuiz() {
    return COMPREHENSION_QUESTION_BANK[0];
  }
}

module.exports = {
  VOICE_PROMPTS,
  VoiceSessionController
};
