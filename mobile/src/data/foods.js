const FOODS = [
  // ── GLOBAL FOODS ──
  { id:"f1",  region:"global", name:"Chicken Breast",     serving:"100g",         cal:165, p:31,  c:0,  f:3.6 },
  { id:"f2",  region:"global", name:"Brown Rice",         serving:"100g cooked",  cal:112, p:2.6, c:23, f:0.9 },
  { id:"f3",  region:"global", name:"Banana",             serving:"1 medium",     cal:89,  p:1.1, c:23, f:0.3 },
  { id:"f4",  region:"global", name:"Whole Egg",          serving:"1 large",      cal:72,  p:6,   c:0.4,f:5   },
  { id:"f5",  region:"global", name:"Greek Yogurt",       serving:"170g",         cal:100, p:17,  c:6,  f:0.7 },
  { id:"f6",  region:"global", name:"Almonds",            serving:"28g",          cal:164, p:6,   c:6,  f:14  },
  { id:"f7",  region:"global", name:"Oats",               serving:"40g dry",      cal:150, p:5,   c:27, f:3   },
  { id:"f8",  region:"global", name:"Salmon",             serving:"100g",         cal:208, p:20,  c:0,  f:13  },
  { id:"f9",  region:"global", name:"Sweet Potato",       serving:"100g",         cal:86,  p:1.6, c:20, f:0.1 },
  { id:"f10", region:"global", name:"Avocado",            serving:"100g",         cal:160, p:2,   c:9,  f:15  },
  { id:"f11", region:"global", name:"Broccoli",           serving:"100g",         cal:34,  p:2.8, c:7,  f:0.4 },
  { id:"f12", region:"global", name:"Tuna (canned)",      serving:"100g",         cal:116, p:26,  c:0,  f:1   },
  { id:"f13", region:"global", name:"White Rice",         serving:"100g cooked",  cal:130, p:2.7, c:28, f:0.3 },
  { id:"f14", region:"global", name:"Peanut Butter",      serving:"2 tbsp",       cal:190, p:8,   c:6,  f:16  },
  { id:"f15", region:"global", name:"Cottage Cheese",     serving:"100g",         cal:98,  p:11,  c:3.4,f:4.3 },
  { id:"f16", region:"global", name:"Lentils",            serving:"100g cooked",  cal:116, p:9,   c:20, f:0.4 },
  { id:"f17", region:"global", name:"Whole Milk",         serving:"240ml",        cal:149, p:8,   c:12, f:8   },
  { id:"f18", region:"global", name:"Orange",             serving:"1 medium",     cal:62,  p:1.2, c:15, f:0.2 },
  { id:"f19", region:"global", name:"Spinach",            serving:"100g",         cal:23,  p:2.9, c:3.6,f:0.4 },
  { id:"f20", region:"global", name:"Lean Ground Beef",   serving:"100g",         cal:215, p:26,  c:0,  f:12  },
  { id:"f21", region:"global", name:"Quinoa",             serving:"100g cooked",  cal:120, p:4.4, c:21, f:1.9 },
  { id:"f22", region:"global", name:"Apple",              serving:"1 medium",     cal:95,  p:0.5, c:25, f:0.3 },
  { id:"f23", region:"global", name:"Whey Protein",       serving:"1 scoop 30g",  cal:120, p:24,  c:3,  f:2   },
  { id:"f24", region:"global", name:"Olive Oil",          serving:"1 tbsp",       cal:119, p:0,   c:0,  f:14  },
  { id:"f25", region:"global", name:"Blueberries",        serving:"100g",         cal:57,  p:0.7, c:14, f:0.3 },

  // ── UGANDAN STAPLES ──
  { id:"af01", region:"african", country:"Uganda",   emoji:"🍌", name:"Matoke (steamed)",       serving:"200g",  cal:176, p:2,   c:45, f:0.4 },
  { id:"af02", region:"african", country:"Uganda",   emoji:"🌽", name:"Posho / Ugali",           serving:"150g",  cal:207, p:2,   c:46, f:0.6 },
  { id:"af03", region:"african", country:"Uganda",   emoji:"🌯", name:"Rolex (egg & chapati)",   serving:"1 piece",cal:320,p:12,  c:38, f:13  },
  { id:"af04", region:"african", country:"Uganda",   emoji:"🥜", name:"Groundnut Stew",          serving:"200g",  cal:380, p:14,  c:18, f:28  },
  { id:"af05", region:"african", country:"Uganda",   emoji:"🍲", name:"Katogo (offal stew)",     serving:"200g",  cal:290, p:22,  c:18, f:14  },
  { id:"af06", region:"african", country:"Uganda",   emoji:"🫘", name:"Matooke & beans",         serving:"300g",  cal:340, p:12,  c:65, f:2   },
  { id:"af07", region:"african", country:"Uganda",   emoji:"🦟", name:"Nswaa (fried termites)",  serving:"50g",   cal:140, p:18,  c:4,  f:7   },
  { id:"af08", region:"african", country:"Uganda",   emoji:"🌿", name:"Sim Sim (sesame) paste",  serving:"30g tbsp",cal:170,p:5,  c:6,  f:15  },
  { id:"af09", region:"african", country:"Uganda",   emoji:"🥔", name:"Cassava (boiled)",        serving:"150g",  cal:198, p:1.5, c:48, f:0.3 },
  { id:"af10", region:"african", country:"Uganda",   emoji:"🎋", name:"Malewa (bamboo shoots)",  serving:"100g",  cal:27,  p:2.6, c:5,  f:0.3 },

  // ── KENYAN STAPLES ──
  { id:"af11", region:"african", country:"Kenya",    emoji:"🌽", name:"Ugali (maize)",           serving:"150g",  cal:216, p:2.1, c:48, f:0.6 },
  { id:"af12", region:"african", country:"Kenya",    emoji:"🥬", name:"Sukuma Wiki",              serving:"100g",  cal:35,  p:3.4, c:6,  f:0.7 },
  { id:"af13", region:"african", country:"Kenya",    emoji:"🥩", name:"Nyama Choma (goat)",      serving:"100g",  cal:273, p:49,  c:3,  f:6   },
  { id:"af14", region:"african", country:"Kenya",    emoji:"🫓", name:"Chapati (1 piece)",        serving:"60g",   cal:150, p:4,   c:26, f:4   },
  { id:"af15", region:"african", country:"Kenya",    emoji:"🫘", name:"Githeri (maize+beans)",   serving:"200g",  cal:280, p:14,  c:48, f:2   },
  { id:"af16", region:"african", country:"Kenya",    emoji:"🥔", name:"Mukimo",                  serving:"200g",  cal:240, p:6,   c:48, f:2   },
  { id:"af17", region:"african", country:"Kenya",    emoji:"🌽", name:"Irio",                    serving:"200g",  cal:220, p:7,   c:42, f:2   },
  { id:"af18", region:"african", country:"Kenya",    emoji:"🐟", name:"Omena (dried fish)",      serving:"50g",   cal:116, p:20,  c:0,  f:4   },
  { id:"af19", region:"african", country:"Kenya",    emoji:"🍩", name:"Mandazi (1 piece)",       serving:"50g",   cal:160, p:3,   c:26, f:5   },
  { id:"af20", region:"african", country:"Kenya",    emoji:"🥗", name:"Kachumbari salad",        serving:"100g",  cal:25,  p:1,   c:5,  f:0.2 },
  { id:"af21", region:"african", country:"Kenya",    emoji:"🥟", name:"Samosa (1 piece)",        serving:"60g",   cal:190, p:5,   c:20, f:10  },
  { id:"af22", region:"african", country:"Kenya",    emoji:"🍚", name:"Pilau rice",              serving:"200g",  cal:320, p:8,   c:58, f:6   },
  { id:"af23", region:"african", country:"Kenya",    emoji:"🥣", name:"Uji (millet porridge)",   serving:"250ml", cal:130, p:3,   c:28, f:1   },
  { id:"af24", region:"african", country:"Kenya",    emoji:"🐟", name:"Tilapia (Lake Vic.)",     serving:"100g",  cal:128, p:26,  c:0,  f:3   },
  { id:"af25", region:"african", country:"Kenya",    emoji:"🥔", name:"Bhajia (potato snack)",   serving:"100g",  cal:220, p:4,   c:28, f:11  },

  // ── TANZANIAN DISHES ──
  { id:"af26", region:"african", country:"Tanzania", emoji:"🍚", name:"Wali wa Nazi (coconut rice)",   serving:"200g", cal:340, p:5,   c:60, f:9  },
  { id:"af27", region:"african", country:"Tanzania", emoji:"🍛", name:"Biryani (meat & rice)",          serving:"250g", cal:420, p:22,  c:52, f:12 },
  { id:"af28", region:"african", country:"Tanzania", emoji:"🌽", name:"Ugali (cassava)",                serving:"150g", cal:195, p:1.5, c:47, f:0.2},
  { id:"af29", region:"african", country:"Tanzania", emoji:"🍢", name:"Mshikaki (meat skewer)",         serving:"100g", cal:210, p:24,  c:4,  f:11 },
  { id:"af30", region:"african", country:"Tanzania", emoji:"🌮", name:"Zanzibar mix (street food)",     serving:"200g", cal:380, p:12,  c:48, f:16 },

  // ── RWANDAN / CENTRAL EAST AFRICAN ──
  { id:"af31", region:"african", country:"Rwanda",   emoji:"🌿", name:"Isombe (cassava leaves)",        serving:"150g", cal:95,  p:5,   c:14, f:3  },
  { id:"af32", region:"african", country:"Rwanda",   emoji:"🫘", name:"Igisafuliya (cowpea stew)",      serving:"200g", cal:230, p:12,  c:34, f:5  },
  { id:"af33", region:"african", country:"Rwanda",   emoji:"🍢", name:"Brochette (grilled meat)",       serving:"100g", cal:215, p:25,  c:2,  f:12 },
  { id:"af34", region:"african", country:"Rwanda",   emoji:"🍌", name:"Mizuzu (fried plantain)",        serving:"100g", cal:180, p:1.5, c:42, f:1  },

  // ── DRINKS & EXTRAS (East African) ──
  { id:"af35", region:"african", country:"EA",       emoji:"🍵", name:"Chai (spiced milk tea)",         serving:"240ml",cal:90,  p:3,   c:14, f:3  },
  { id:"af36", region:"african", country:"Kenya",    emoji:"🍹", name:"Dawa cocktail (honey+lime)",     serving:"200ml",cal:120, p:0,   c:30, f:0  },
  { id:"af37", region:"african", country:"EA",       emoji:"🥭", name:"Fresh mango juice",              serving:"300ml",cal:130, p:1,   c:33, f:0.5},
  { id:"af38", region:"african", country:"EA",       emoji:"🍊", name:"Passion fruit juice",            serving:"300ml",cal:105, p:1,   c:27, f:0.2},
  { id:"af39", region:"african", country:"Uganda",   emoji:"🍺", name:"Fermented millet (obushera)",    serving:"300ml",cal:115, p:2,   c:24, f:0.5},
  { id:"af40", region:"african", country:"EA",       emoji:"🌽", name:"Roasted maize (corn cob)",       serving:"100g", cal:130, p:3.5, c:27, f:2  },
  { id:"af41", region:"african", country:"EA",       emoji:"🍠", name:"Sweet potato (boiled)",          serving:"150g", cal:129, p:2.4, c:30, f:0.2},
  { id:"af42", region:"african", country:"EA",       emoji:"🎃", name:"Pumpkin (boiled)",               serving:"100g", cal:26,  p:1,   c:6,  f:0.1},
  { id:"af43", region:"african", country:"EA",       emoji:"🫘", name:"Ndengu (green grams)",           serving:"150g", cal:180, p:13,  c:30, f:1  },
  { id:"af44", region:"african", country:"EA",       emoji:"🫘", name:"Red kidney beans (cooked)",      serving:"150g", cal:170, p:12,  c:30, f:0.5},
  { id:"af45", region:"african", country:"EA",       emoji:"🥜", name:"Groundnuts (roasted)",           serving:"30g",  cal:170, p:7,   c:5,  f:14 },
  { id:"af46", region:"african", country:"EA",       emoji:"🟡", name:"Jackfruit (ripe)",               serving:"100g", cal:95,  p:1.7, c:23, f:0.6},
  { id:"af47", region:"african", country:"EA",       emoji:"🥑", name:"Avocado (hass, 1 medium)",       serving:"150g", cal:240, p:3,   c:13, f:22 },
  { id:"af48", region:"african", country:"EA",       emoji:"🍆", name:"Eggplant stew",                  serving:"200g", cal:110, p:3,   c:14, f:5  },
  { id:"af49", region:"african", country:"EA",       emoji:"🥩", name:"Liver (beef, fried)",            serving:"100g", cal:175, p:27,  c:5,  f:5  },
  { id:"af50", region:"african", country:"EA",       emoji:"🍲", name:"Matumbo (tripe stew)",           serving:"150g", cal:180, p:20,  c:5,  f:9  },
];

const AFRICAN_QUICK_PICKS = ["Ugali","Matoke","Chapati","Nyama Choma","Rolex","Sukuma Wiki","Pilau rice","Githeri (maize+beans)","Mandazi (1 piece)","Chai (spiced milk tea)"];

const COUNTRY_FLAGS = { Uganda:"🇺🇬", Kenya:"🇰🇪", Tanzania:"🇹🇿", Rwanda:"🇷🇼", EA:"🌍" };

const GPS_WORKOUT_TYPES = [
  { id:"running",  label:"Running",  emoji:"🏃", met:8.5  },
  { id:"cycling",  label:"Cycling",  emoji:"🚴", met:6.0  },
  { id:"walking",  label:"Walking",  emoji:"🚶", met:3.5  },
  { id:"hiking",   label:"Hiking",   emoji:"🥾", met:5.3  },
];

export { FOODS, AFRICAN_QUICK_PICKS, COUNTRY_FLAGS, GPS_WORKOUT_TYPES };
