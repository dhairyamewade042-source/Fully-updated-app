// Roman (English-spelt) -> Hindi (Devanagari) transliteration for CUSTOMER NAMES only.
// Strategy for reliable, natural results (fully offline):
//   1) A curated dictionary of common Indian names (Hindu / Muslim / Sikh / regional
//      first names + surnames + abbreviations) gives exact, natural spellings.
//   2) Anything not in the dictionary falls back to a phonetic engine that handles
//      schwa (inherent 'a'), gemination (doubled consonants), nasal assimilation
//      (n/m before a consonant -> anusvara), and common vowel/consonant digraphs.
// This is transliteration by pronunciation — never meaning-translation.

// ---- 1) Curated name dictionary (lowercase key -> Devanagari) ----
const NAME_MAP: Record<string, string> = {
  // Muslim first names
  shabbir: "शब्बीर", imran: "इमरान", arif: "आरिफ", salman: "सलमान",
  mohd: "मोहम्मद", md: "मोहम्मद", mohammad: "मोहम्मद", mohammed: "मोहम्मद",
  muhammad: "मुहम्मद", mohammod: "मोहम्मद", mohsin: "मोहसिन",
  ali: "अली", iqbal: "इक़बाल", rahim: "रहीम", karim: "करीम", kareem: "करीम",
  sameer: "समीर", samir: "समीर", nadeem: "नदीम", javed: "जावेद", javeed: "जावेद",
  rashid: "राशिद", rasheed: "रशीद", aslam: "असलम", akram: "अकरम", anwar: "अनवर",
  ayesha: "आयशा", aisha: "आयशा", fatima: "फातिमा", farhan: "फरहान",
  faisal: "फैसल", faizal: "फैसल", hamid: "हामिद", hasan: "हसन", hassan: "हसन",
  hussain: "हुसैन", husain: "हुसैन", irfan: "इरफान", jamal: "जमाल", kamal: "कमाल",
  mehboob: "महबूब", naeem: "नईम", nasir: "नासिर", parvez: "परवेज", qadir: "कादिर",
  rafiq: "रफीक", rafique: "रफीक", rehan: "रेहान", riyaz: "रियाज", riaz: "रियाज",
  saleem: "सलीम", salim: "सलीम", shahid: "शाहिद", sharif: "शरीफ", shareef: "शरीफ",
  sohail: "सुहैल", suhail: "सुहैल", tariq: "तारिक", wasim: "वसीम", waseem: "वसीम",
  zahid: "ज़ाहिद", zubair: "ज़ुबैर", abdul: "अब्दुल", rehman: "रहमान", rahman: "रहमान",
  sultan: "सुल्तान", feroz: "फिरोज", firoz: "फिरोज", ghulam: "गुलाम", gulam: "गुलाम",
  yusuf: "यूसुफ", ibrahim: "इब्राहीम", ismail: "इस्माईल", asif: "आसिफ", altaf: "अल्ताफ",
  shakeel: "शकील", shakir: "शाकिर", tanveer: "तनवीर", zeeshan: "ज़ीशान", danish: "दानिश",
  // Muslim female
  rukhsana: "रुख़साना", nazma: "नज़मा", shabana: "शबाना", farida: "फरीदा",
  saba: "सबा", nafisa: "नफीसा", shaheen: "शाहीन", rubina: "रुबीना",
  // Hindu first names (male)
  ramesh: "रमेश", suresh: "सुरेश", rajesh: "राजेश", mahesh: "महेश", dinesh: "दिनेश",
  naresh: "नरेश", mukesh: "मुकेश", hitesh: "हितेश", ritesh: "रितेश", ganesh: "गणेश",
  rakesh: "राकेश", kamlesh: "कमलेश", yogesh: "योगेश", lokesh: "लोकेश", jignesh: "जिग्नेश",
  mohan: "मोहन", sohan: "सोहन", rohan: "रोहन", gopal: "गोपाल", shyam: "श्याम",
  ram: "राम", shiv: "शिव", shiva: "शिव", krishna: "कृष्ण", vishnu: "विष्णु",
  anil: "अनिल", sunil: "सुनील", kapil: "कपिल", vijay: "विजय", ajay: "अजय",
  sanjay: "संजय", vinay: "विनय", amit: "अमित", sumit: "सुमित", rohit: "रोहित",
  mohit: "मोहित", lalit: "ललित", ankit: "अंकित", pankaj: "पंकज", manoj: "मनोज",
  saroj: "सरोज", raj: "राज", ravi: "रवि", deepak: "दीपक", dipak: "दीपक",
  prakash: "प्रकाश", vikas: "विकास", vikash: "विकाश", ashok: "अशोक", alok: "आलोक",
  ashish: "आशीष", manish: "मनीष", satish: "सतीश", bharat: "भरत", arjun: "अर्जुन",
  karan: "करण", varun: "वरुण", tarun: "तरुण", gaurav: "गौरव", saurabh: "सौरभ",
  saurav: "सौरव", vaibhav: "वैभव", rahul: "राहुल", rajkumar: "राजकुमार",
  kumar: "कुमार", kishan: "किशन", kishen: "किशन", kishore: "किशोर",
  mahendra: "महेंद्र", narendra: "नरेंद्र", surendra: "सुरेंद्र", rajendra: "राजेंद्र",
  devendra: "देवेंद्र", jitendra: "जितेंद्र", shailendra: "शैलेंद्र",
  ramchandra: "रामचंद्र", mohanlal: "मोहनलाल", omprakash: "ओमप्रकाश",
  shankar: "शंकर", hari: "हरी", om: "ओम", banwari: "बनवारी", girdhari: "गिरधारी",
  murari: "मुरारी", chandan: "चंदन", nitin: "नितिन", sachin: "सचिन", jatin: "जतिन",
  naveen: "नवीन", praveen: "प्रवीण", pravin: "प्रवीण", gopi: "गोपी", govind: "गोविंद",
  // Hindu female
  sunita: "सुनीता", anita: "अनीता", geeta: "गीता", gita: "गीता", sita: "सीता",
  rita: "रीता", pooja: "पूजा", puja: "पूजा", neha: "नेहा", priya: "प्रिया",
  kavita: "कविता", savita: "सविता", lata: "लता", rekha: "रेखा", meena: "मीना",
  seema: "सीमा", reena: "रीना", rina: "रीना", rani: "रानी", laxmi: "लक्ष्मी",
  lakshmi: "लक्ष्मी", radha: "राधा", sarita: "सरिता", mamta: "ममता", suman: "सुमन",
  kiran: "किरण", poonam: "पूनम", sonam: "सोनम", asha: "आशा", usha: "उषा",
  // Common surnames
  sharma: "शर्मा", verma: "वर्मा", gupta: "गुप्ता", singh: "सिंह", yadav: "यादव",
  patel: "पटेल", shah: "शाह", jain: "जैन", agarwal: "अग्रवाल", aggarwal: "अग्रवाल",
  mishra: "मिश्रा", tiwari: "तिवारी", pandey: "पांडेय", dubey: "दुबे", chauhan: "चौहान",
  rathore: "राठौड़", rathod: "राठौड़", thakur: "ठाकुर", prajapati: "प्रजापति",
  vishwakarma: "विश्वकर्मा", soni: "सोनी", mehta: "मेहता", joshi: "जोशी",
  desai: "देसाई", reddy: "रेड्डी", rao: "राव", naidu: "नायडू", pillai: "पिल्लई",
  nair: "नायर", iyer: "अय्यर", das: "दास", ghosh: "घोष", bose: "बोस", roy: "राय",
  sen: "सेन", banerjee: "बनर्जी", chatterjee: "चटर्जी", mukherjee: "मुखर्जी",
  ansari: "अंसारी", qureshi: "कुरैशी", sheikh: "शेख", shaikh: "शेख", syed: "सैयद",
  sayyed: "सैयद", pathan: "पठान", malik: "मलिक", mansuri: "मंसूरी", saifi: "सैफी",
  khan: "खान", chaudhary: "चौधरी", choudhary: "चौधरी", saini: "सैनी",
  gujjar: "गुज्जर", jat: "जाट", nishad: "निषाद", kushwaha: "कुशवाहा", maurya: "मौर्य",
};

// ---- 2) Phonetic fallback engine ----
type V = { seq: string; a: string; b: string };
const VOWELS: V[] = [
  { seq: "aa", a: "आ", b: "ा" }, { seq: "ai", a: "ऐ", b: "ै" }, { seq: "au", a: "औ", b: "ौ" },
  { seq: "ee", a: "ई", b: "ी" }, { seq: "ii", a: "ई", b: "ी" }, { seq: "oo", a: "ऊ", b: "ू" },
  { seq: "uu", a: "ऊ", b: "ू" }, { seq: "a", a: "अ", b: "" }, { seq: "e", a: "ए", b: "े" },
  { seq: "i", a: "इ", b: "ि" }, { seq: "o", a: "ओ", b: "ो" }, { seq: "u", a: "उ", b: "ु" },
];
const CONSONANTS: { seq: string; d: string }[] = [
  { seq: "chh", d: "छ" }, { seq: "shh", d: "ष" }, { seq: "kh", d: "ख" }, { seq: "gh", d: "घ" },
  { seq: "ch", d: "च" }, { seq: "jh", d: "झ" }, { seq: "th", d: "थ" }, { seq: "dh", d: "ध" },
  { seq: "ph", d: "फ" }, { seq: "bh", d: "भ" }, { seq: "sh", d: "श" }, { seq: "ck", d: "क" },
  { seq: "k", d: "क" }, { seq: "g", d: "ग" }, { seq: "c", d: "क" }, { seq: "j", d: "ज" },
  { seq: "t", d: "त" }, { seq: "d", d: "द" }, { seq: "n", d: "न" }, { seq: "p", d: "प" },
  { seq: "b", d: "ब" }, { seq: "m", d: "म" }, { seq: "r", d: "र" }, { seq: "l", d: "ल" },
  { seq: "v", d: "व" }, { seq: "w", d: "व" }, { seq: "s", d: "स" }, { seq: "h", d: "ह" },
  { seq: "f", d: "फ" }, { seq: "z", d: "ज़" }, { seq: "x", d: "क्स" }, { seq: "q", d: "क़" },
  { seq: "y", d: "य" },
];
const isConsonantStart = (s: string, i: number) => CONSONANTS.some((u) => s.startsWith(u.seq, i));
const matchVowel = (s: string, i: number) => VOWELS.find((u) => s.startsWith(u.seq, i));
const matchCons = (s: string, i: number) => CONSONANTS.find((u) => s.startsWith(u.seq, i));

const transliterateWord = (raw: string): string => {
  const w = raw.toLowerCase();
  let out = "";
  let i = 0;
  let prevConsonant = false;
  while (i < w.length) {
    // Nasal assimilation: n/m before a DIFFERENT consonant, after a vowel -> anusvara.
    if ((w[i] === "n" || w[i] === "m") && !prevConsonant) {
      const next = w[i + 1];
      if (next && next !== w[i] && isConsonantStart(w, i + 1)) {
        out += "ं";
        i += 1;
        prevConsonant = false;
        continue;
      }
    }
    // Trailing / pre-consonant 'y' behaves like a long 'ee' (e.g. "Rocky").
    if (w[i] === "y" && prevConsonant) {
      const next = w[i + 1];
      if (next === undefined || !/[a-z]/.test(next) || isConsonantStart(w, i + 1)) {
        out += "ी";
        prevConsonant = false;
        i += 1;
        continue;
      }
    }
    const v = matchVowel(w, i);
    if (v) {
      out += prevConsonant ? v.b : v.a;
      prevConsonant = false;
      i += v.seq.length;
      continue;
    }
    const c = matchCons(w, i);
    if (c) {
      // Gemination: doubled consonant -> halant join (e.g. "bb" -> ब्ब).
      if (prevConsonant && w[i] === w[i - 1]) out += "\u094D";
      out += c.d;
      prevConsonant = true;
      i += c.seq.length;
      continue;
    }
    out += w[i];
    prevConsonant = false;
    i += 1;
  }
  return out;
};

const normalize = (word: string) => word.toLowerCase().replace(/[^a-z]/g, "");

export const toHindiName = (name: string): string =>
  String(name)
    .split(/(\s+)/) // keep whitespace separators
    .map((part) => {
      if (/^\s+$/.test(part) || part === "") return part;
      const key = normalize(part);
      if (key && NAME_MAP[key]) return NAME_MAP[key];
      return transliterateWord(part);
    })
    .join("");
