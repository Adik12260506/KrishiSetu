/**
 * Multi-Lingual Comprehension Quiz & Verification Engine
 * Non-negotiable constraint: The farmer MUST pass comprehension verification
 * before a policy becomes legally and financially bound.
 */

const COMPREHENSION_QUESTION_BANK = [
  {
    question_id: 'Q_DROUGHT_TRIGGER_01',
    category: 'TRIGGER_RULE',
    text: {
      en: 'If rainfall is 20 mm (below the 35 mm limit), will you receive an automatic payout?',
      hi: 'यदि 14 दिनों में केवल 20 मिमी बारिश होती है (35 मिमी सीमा से कम), तो क्या आपको स्वतः बीमा मिलेगा?',
      te: 'మీ ప్రాంతంలో 20 మి.మీ వర్షం మాత్రమే పడితే (35 మి.మీ పరిమితి కంటే తక్కువ), మీకు ఆటోమేటిక్ పరిహారం అందుతుందా?',
      or: 'ଯଦି ୧୪ ଦିନରେ କେବଳ ୨୦ ମିଲିମିଟର ବର୍ଷା ହୁଏ (୩୫ ମିମି ସୀମାରୁ କମ), ତେବେ ଆପଣଙ୍କୁ ସ୍ୱତଃ ବୀମା ପରିଶୋଧ ମିଳିବ କି?'
    },
    audio_cue: 'cue_q1_rainfall_trigger',
    options: [
      {
        option_id: '1',
        keypad_key: '1',
        voice_keywords: ['yes', 'haan', 'ha', 'avunu', 'ho', 'han', 'hote', 'thik', 'sahi', 'true', 'right'],
        text: { en: '1: Yes, automatic payout (हाँ)', hi: '1: हाँ, स्वतः भुगतान मिलेगा', te: '1: అవును, పరిహారం అందుతుంది', or: '1: ହଁ, ସ୍ୱତଃ ପରିଶୋଧ ମିଳିବ' },
        is_correct: true
      },
      {
        option_id: '2',
        keypad_key: '2',
        voice_keywords: ['no', 'nahi', 'nahin', 'na', 'ledu', 'bhul', 'galat', 'false', 'wrong'],
        text: { en: '2: No payout (नहीं)', hi: '2: नहीं, भुगतान नहीं मिलेगा', te: '2: లేదు, పరిహారం అందదు', or: '2: ନାହିଁ, ଟଙ୍କା ମିଳିବ ନାହିଁ' },
        is_correct: false
      }
    ],
    explanation: {
      en: 'Correct! When rainfall is below 35 mm, payout is automatically calculated without paperwork or surveyor visits.',
      hi: 'बिल्कुल सही! 35 मिमी से कम बारिश होने पर बिना किसी कागजी कार्रवाई या सर्वेक्षक के तुरंत भुगतान मिलता है।',
      te: 'సరైన సమాధానం! 35 మి.మీ కంటే తక్కువ వర్షం పడినప్పుడు కాగితాలు లేకుండా నేరుగా పరిహారం అందుతుంది.',
      or: 'ଠିକ ଉତ୍ତର! ୩୫ ମିମିରୁ କମ ବର୍ଷା ହେଲେ ବିନା କାଗଜପତ୍ର କିମ୍ବା ସର୍ଭେୟରରେ ସିଧାସଳଖ ପରିଶୋଧ ମିଳିବ।'
    }
  },
  {
    question_id: 'Q_OFFLINE_SPEND_02',
    category: 'WALLET_USABILITY',
    text: {
      en: 'Can you spend your payout at local seed and fertilizer shops even when there is NO internet?',
      hi: 'क्या आप इंटरनेट न होने पर भी स्थानीय बीज-खाद दुकान पर बीमा राशि खर्च कर सकते हैं?',
      te: 'ఇంటర్నెట్ లేకపోయినా మీరు స్థానిక ఎరువులు మరియు విత్తనాల దుకాణంలో మీ పరిహార సొమ్మును ఖర్చు చేయవచ్చా?',
      or: 'ଇଣ୍ଟରନେଟ ନଥିଲେ ମଧ୍ୟ ଆପଣ ସ୍ଥାନୀୟ ବିହନ-ଖତ ଦୋକାନରେ ବୀମା ଟଙ୍କା ଖର୍ଚ୍ଚ କରିପାରିବେ କି?'
    },
    audio_cue: 'cue_q2_offline_wallet',
    options: [
      {
        option_id: '1',
        keypad_key: '1',
        voice_keywords: ['yes', 'haan', 'ha', 'avunu', 'ho', 'han', 'hote', 'thik', 'sahi', 'true'],
        text: { en: '1: Yes, works completely offline (हाँ)', hi: '1: हाँ, ऑफलाइन भी काम करेगा', te: '1: అవును, ఆఫ్‌లైన్‌లో కూడా పనిచేస్తుంది', or: '1: ହଁ, ଅଫଲାଇନରେ ମଧ୍ୟ କାମ କରିବ' },
        is_correct: true
      },
      {
        option_id: '2',
        keypad_key: '2',
        voice_keywords: ['no', 'nahi', 'nahin', 'na', 'ledu', 'bhul', 'galat'],
        text: { en: '2: No, internet is required (नहीं)', hi: '2: नहीं, इंटरनेट जरूरी है', te: '2: లేదు, ఇంటర్నెట్ కావాలి', or: '2: ନାହିଁ, ଇଣ୍ଟରନେଟ ଦରକାର' },
        is_correct: false
      }
    ],
    explanation: {
      en: 'Correct! The offline wallet lets you transact immediately even during complete network shutdown.',
      hi: 'सही! ऑफलाइन वॉलेट नेटवर्क बंद होने पर भी तुरंत काम करता है।',
      te: 'సరైన సమాధానం! నెట్‌వర్క్ లేకపోయినా ఆఫ్‌లైన్ వాలెట్ ద్వారా వెంటనే ఖర్చు చేసుకోవచ్చు.',
      or: 'ଠିକ ଉତ୍ତର! ନେଟୱର୍କ ବନ୍ଦ ଥିଲେ ମଧ୍ୟ ଅଫଲାଇନ୍ ୱାଲେଟ୍ ଦ୍ୱାରା ତୁରନ୍ତ ଟଙ୍କା ଖର୍ଚ୍ଚ କରିହେବ।'
    }
  }
];

function evaluateComprehensionAnswer(questionId, userInput, inputMode = 'VOICE') {
  const question = COMPREHENSION_QUESTION_BANK.find(q => q.question_id === questionId) || COMPREHENSION_QUESTION_BANK[0];
  const normalizedInput = String(userInput).trim().toLowerCase();

  let selectedOption = null;

  // 1. Direct keypad digit match
  if (normalizedInput === '1' || normalizedInput === 'option 1' || normalizedInput === 'one') {
    selectedOption = question.options.find(o => o.option_id === '1');
  } else if (normalizedInput === '2' || normalizedInput === 'option 2' || normalizedInput === 'two') {
    selectedOption = question.options.find(o => o.option_id === '2');
  } else {
    // 2. Multi-lingual voice keyword match
    for (const opt of question.options) {
      if (opt.voice_keywords.some(kw => normalizedInput.includes(kw))) {
        selectedOption = opt;
        break;
      }
    }
  }

  if (!selectedOption) {
    return {
      success: false,
      recognized: false,
      passed: false,
      message: 'Could not understand response. Please press 1 for Yes or 2 for No on your keypad.',
      fallback_to_keypad: true
    };
  }

  return {
    success: true,
    recognized: true,
    selected_option_id: selectedOption.option_id,
    passed: selectedOption.is_correct,
    explanation: question.explanation,
    input_mode: inputMode
  };
}

module.exports = {
  COMPREHENSION_QUESTION_BANK,
  evaluateComprehensionAnswer
};
